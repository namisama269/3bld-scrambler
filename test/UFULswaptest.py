import sys
import os

# Add project root to path so we can import from root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dlin import Tracer, BUFFERS

def trace_edges_with_swap(scramble, swap_pair):
    """
    Trace edges only, with a manual swap applied before the scramble.

    Args:
        scramble: The scramble string
        swap_pair: Tuple of two edges to swap, e.g. ("UF", "UR") or ("UF", "UL")

    Returns:
        Raw tracing result dict with edge cycles
    """
    # Buffer order: swapped piece comes second
    if swap_pair == ("UF", "UR"):
        edge_buffers = ["UF", "UR", "UL", "UB", "FR", "FL", "DR", "DL", "BR", "DF", "DB", "BL"]
    elif swap_pair == ("UF", "UL"):
        edge_buffers = ["UF", "UL", "UR", "UB", "FR", "FL", "DR", "DL", "BR", "DF", "DB", "BL"]
    else:
        raise ValueError(f"Unknown swap pair: {swap_pair}")

    tracer = Tracer(BUFFERS, trace="edges")
    # Apply swap first on solved cube, then scramble
    tracer.manual_swap(swap_pair[0], swap_pair[1])
    tracer.scramble_from_string(scramble)
    tracer.tracing = {"edge": [], "corner": [], "scramble": scramble}
    tracer.rotate_into_orientation()
    tracer.trace_all("edge", edge_buffers)

    return tracer.tracing

def trace_both_swaps(scramble):
    """
    Run both UF/UR and UF/UL swap tracings on a scramble.

    Returns:
        Dict with 'UR_swap' and 'UL_swap' raw tracing results
    """
    return {
        "scramble": scramble,
        "UR_swap": trace_edges_with_swap(scramble, ("UF", "UR")),
        "UL_swap": trace_edges_with_swap(scramble, ("UF", "UL"))
    }

def calculate_stats(tracing):
    """
    Calculate stats for a tracing result.

    Returns:
        Dict with 'algs', 'targets', '2flips'
    """
    algs = 0
    targets = 0
    two_flips = 0

    # Count misoriented cycles (ori=1, parity=0, type=misoriented)
    misoriented_count = 0
    for cycle in tracing["edge"]:
        if cycle["type"] == "misoriented" and cycle["orientation"] == 1 and cycle["parity"] == 0:
            misoriented_count += 1

    # For every 2 misoriented cycles, add 1 to 2flips
    two_flips = misoriented_count // 2
    # If there's 1 remaining misoriented cycle, add 1 to algs
    if misoriented_count % 2 == 1:
        algs += 1

    # Calculate targets
    # First add len(UF buffer cycle targets) if it exists
    uf_cycle = None
    other_cycles = []
    for cycle in tracing["edge"]:
        if cycle["buffer"] == "UF" and cycle["type"] == "cycle":
            uf_cycle = cycle
        elif cycle["type"] == "cycle":
            other_cycles.append(cycle)

    if uf_cycle:
        targets += len(uf_cycle["targets"])

    # For each other buffer type=cycle, add 2 plus the length of targets
    for cycle in other_cycles:
        targets += 2 + len(cycle["targets"])

    # targets should be even, divide by 2 and add to algs
    algs += targets // 2

    # Add 2flips to algs as well
    algs += two_flips

    return {
        "algs": algs,
        "targets": targets,
        "2flips": two_flips
    }

def print_raw_tracing(tracing, label):
    """Print raw tracing result for debugging"""
    print(f"\n  {label}:")
    for i, cycle in enumerate(tracing["edge"]):
        print(f"    Cycle {i+1}: buffer={cycle['buffer']}, type={cycle['type']}, "
              f"targets={cycle['targets']}, ori={cycle['orientation']}, parity={cycle['parity']}")

    # Calculate and print stats
    stats = calculate_stats(tracing)
    print(f"    Stats: algs={stats['algs']}, targets={stats['targets']}, 2flips={stats['2flips']}")

def process_file(filepath):
    """
    Read scrambles from a file and report statistics.
    """
    with open(filepath, "r") as f:
        scrambles = [line.strip() for line in f if line.strip()]

    if not scrambles:
        print("No scrambles found in file.")
        return

    # Totals for UR swap
    ur_total_algs = 0
    ur_total_targets = 0
    ur_total_2flips = 0

    # Totals for UL swap
    ul_total_algs = 0
    ul_total_targets = 0
    ul_total_2flips = 0

    for i, scramble in enumerate(scrambles):
        result = trace_both_swaps(scramble)

        ur_stats = calculate_stats(result["UR_swap"])
        ul_stats = calculate_stats(result["UL_swap"])

        ur_total_algs += ur_stats["algs"]
        ur_total_targets += ur_stats["targets"]
        ur_total_2flips += ur_stats["2flips"]

        ul_total_algs += ul_stats["algs"]
        ul_total_targets += ul_stats["targets"]
        ul_total_2flips += ul_stats["2flips"]

        # Progress indicator every 100 scrambles
        if (i + 1) % 100 == 0:
            print(f"Processed {i + 1}/{len(scrambles)} scrambles...")

    n = len(scrambles)
    print(f"\n=== Results for {n} scrambles ===\n")

    print("UF/UR swap:")
    print(f"  Total:   algs={ur_total_algs}, targets={ur_total_targets}, 2flips={ur_total_2flips}")
    print(f"  Average: algs={ur_total_algs/n:.2f}, targets={ur_total_targets/n:.2f}, 2flips={ur_total_2flips/n:.2f}")

    print("\nUF/UL swap:")
    print(f"  Total:   algs={ul_total_algs}, targets={ul_total_targets}, 2flips={ul_total_2flips}")
    print(f"  Average: algs={ul_total_algs/n:.2f}, targets={ul_total_targets/n:.2f}, 2flips={ul_total_2flips/n:.2f}")


def main():
    # Check for file argument
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        if not os.path.exists(filepath):
            print(f"Error: File not found: {filepath}")
            sys.exit(1)
        process_file(filepath)
        return

    # Interactive mode by default - ask for scrambles
    print("Enter scramble (or 'q' to quit):")
    print("Usage: python UFULswaptest.py <scrambles.txt>")
    while True:
        try:
            scramble = input("> ").strip()
            if scramble.lower() == 'q' or not scramble:
                break

            result = trace_both_swaps(scramble)

            print_raw_tracing(result["UR_swap"], "UF/UR swap")
            print_raw_tracing(result["UL_swap"], "UF/UL swap")
            print()

        except EOFError:
            break

    print("Done")

if __name__ == "__main__":
    main()
