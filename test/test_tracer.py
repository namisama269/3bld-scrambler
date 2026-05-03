import sys
import os

# Add project root to path so we can import from root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dlin import Tracer, BUFFERS

# Target to letter mapping
TARGET_TO_LETTER = {
    "UB": "A",
    "DL": "B",
    "DB": "C",
    "DF": "D",
    "UL": "E",
    "LB": "F",
    "LF": "G",
    "LD": "H",
    "FU": "I",
    "FL": "J",
    "FR": "K",
    "FD": "L",
    "RB": "M",
    "RF": "N",
    "UF": "O",
    "RD": "P",
    "BL": "R",
    "BR": "S",
    "BD": "T",
    "DR": "W",
    "BU": "Y",
    "LU": "Z",
}

def targets_to_letters(targets):
    """Convert list of targets to letter string grouped by 4"""
    letters = [TARGET_TO_LETTER.get(t, "?") for t in targets]
    # Group by 4
    groups = []
    for i in range(0, len(letters), 4):
        groups.append("".join(letters[i:i+4]))
    return " ".join(groups)

def swap_letters(target):
    """Swap the two letters of an edge target (e.g., UF -> FU)"""
    return target[1] + target[0]

def weakswap_edges_UR(scramble):
    """
    Trace edges with weak swap method (UR buffer):
    1. Do two tracings: normal and with UF/UR swapped
    2. Use the UR trace that doesn't contain UF or FU
    3. Returns dict with "targets" and "flips"

    Requires buffer order: UR, UF, then any order for remaining 10 edges
    """
    edge_buffers = ["UR", "UF", "UL", "UB", "FR", "FL", "DR", "DL", "BR", "DF", "DB", "BL"]

    # Tracing 1: Normal (no swap)
    tracer_normal = Tracer(BUFFERS, trace="edges")
    tracer_normal.scramble_from_string(scramble)
    tracer_normal.tracing = {"edge": [], "corner": [], "scramble": scramble}
    tracer_normal.rotate_into_orientation()
    tracer_normal.trace_all("edge", edge_buffers)

    # Tracing 2: With UF/UR swap - also swap buffer order to UF first, UR second
    edge_buffers_swapped = ["UF", "UR", "UL", "UB", "FR", "FL", "DR", "DL", "BR", "DF", "DB", "BL"]
    tracer_swapped = Tracer(BUFFERS, trace="edges")
    tracer_swapped.scramble_from_string(scramble)
    tracer_swapped.manual_swap("UF", "UR")
    tracer_swapped.tracing = {"edge": [], "corner": [], "scramble": scramble}
    tracer_swapped.rotate_into_orientation()
    tracer_swapped.trace_all("edge", edge_buffers_swapped)

    # Find cycle by buffer name
    def get_cycle_by_buffer_name(tracing, buffer_name):
        for cycle in tracing["edge"]:
            if cycle["buffer"] == buffer_name:
                return cycle
        return None

    def contains_target(cycle, target_list):
        if cycle is None:
            return False
        for target in cycle["targets"]:
            if target in target_list:
                return True
        return False

    # Normal tracing: UR is first buffer, check if UR cycle contains UF/FU
    ur_cycle_normal = get_cycle_by_buffer_name(tracer_normal.tracing, "UR")
    # Swapped tracing: UF is first buffer, check if UF cycle contains UR/RU
    uf_cycle_swapped = get_cycle_by_buffer_name(tracer_swapped.tracing, "UF")

    # Choose the tracing where the first buffer's cycle contains the other buffer piece
    # Normal: UR cycle should contain UF/FU
    # Swapped: UF cycle should contain UR/RU
    if contains_target(ur_cycle_normal, ["UF", "FU"]):
        chosen_tracing = tracer_normal.tracing
        used_swap = False
    elif contains_target(uf_cycle_swapped, ["UR", "RU"]):
        chosen_tracing = tracer_swapped.tracing
        used_swap = True
    else:
        # Neither contains the other - use normal as fallback
        chosen_tracing = tracer_normal.tracing
        used_swap = False

    # Build flips list: buffers where orientation=1, parity=0, and targets list is empty
    flips = []
    for cycle in chosen_tracing["edge"]:
        if cycle["orientation"] == 1 and cycle["parity"] == 0 and len(cycle["targets"]) == 0:
            flips.append(cycle["buffer"])

    # Build targets list
    targets = []

    # Determine which buffer is "first" (no append at start/end needed)
    first_buffer = "UF" if used_swap else "UR"

    # First add targets from the first buffer's cycle
    def get_cycle_by_buffer(tracing, buffer):
        for cycle in tracing["edge"]:
            if cycle["buffer"] == buffer:
                return cycle
        return None

    first_cycle = get_cycle_by_buffer(chosen_tracing, first_buffer)
    if first_cycle and first_cycle["targets"]:
        targets.extend(first_cycle["targets"])

    # Build remaining cycles separately, then sort by length (longest first)
    remaining_cycle_targets = []
    remaining_cycles_raw = []  # Keep track of raw cycle data for testing
    for cycle in chosen_tracing["edge"]:
        if cycle["buffer"] == first_buffer:
            continue
        if cycle["type"] == "misoriented":
            continue
        if not cycle["targets"]:
            continue

        # Build this cycle's target list
        cycle_targets = []
        # Add buffer first
        cycle_targets.append(cycle["buffer"])
        # Add all targets
        cycle_targets.extend(cycle["targets"])
        # If orientation is 0, add buffer again
        # If orientation is 1, swap letters and add
        if cycle["orientation"] == 0:
            cycle_targets.append(cycle["buffer"])
        else:
            cycle_targets.append(swap_letters(cycle["buffer"]))

        remaining_cycle_targets.append(cycle_targets)
        remaining_cycles_raw.append(cycle)

    # Sort by length (longest first) - sort both lists together
    combined = list(zip(remaining_cycle_targets, remaining_cycles_raw))
    combined.sort(key=lambda x: len(x[0]), reverse=True)
    if combined:
        remaining_cycle_targets, remaining_cycles_raw = zip(*combined)
        remaining_cycle_targets = list(remaining_cycle_targets)
        remaining_cycles_raw = list(remaining_cycles_raw)
    else:
        remaining_cycle_targets = []
        remaining_cycles_raw = []

    # Add all remaining cycles to targets
    for cycle_targets in remaining_cycle_targets:
        targets.extend(cycle_targets)

    # If targets length is odd, append UF to make it even
    if len(targets) % 2 == 1:
        targets.append("UF")

    # If using swapped tracing, replace UR/RU with UF/FU in targets and flips
    if used_swap:
        def swap_ur_uf(target):
            if target == "UR":
                return "UF"
            elif target == "RU":
                return "FU"
            return target
        targets = [swap_ur_uf(t) for t in targets]
        flips = [swap_ur_uf(f) for f in flips]

    return {
        "targets": targets,
        "flips": flips,
        "used_swap": used_swap,
        "raw_normal": tracer_normal.tracing,
        "raw_swapped": tracer_swapped.tracing,
        "remaining_cycles_sorted": remaining_cycles_raw
    }

def main():
    scram = input("Enter scramble: ")

    print("\n=== Weakswap Edges UR Output ===")
    result = weakswap_edges_UR(scram)

    print(f"\nUsed swap: {result['used_swap']}")
    print(f"Targets: {targets_to_letters(result['targets'])}")
    print(f"Flips: {' '.join(result['flips'])}")

    print("\nRaw normal tracing:")
    print(result['raw_normal'])
    print("\nRaw swapped tracing:")
    print(result['raw_swapped'])

if __name__ == "__main__":
    main()
