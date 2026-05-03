import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from test_tracer import weakswap_edges_UR

def main():
    scrambles_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "F2E_UR.txt")

    with open(scrambles_file, "r") as f:
        scrambles = [line.strip() for line in f if line.strip()]

    for i, scram in enumerate(scrambles):
        result = weakswap_edges_UR(scram)
        targets_count = len(result["targets"])
        flips_count = len(result["flips"])
        remaining_cycles = result["remaining_cycles_sorted"]

        try:
            assert targets_count == 14, f"Expected 14 targets, got {targets_count}"
            assert flips_count == 0, f"Expected 0 flips, got {flips_count}"

            # Check shortest cycle (last in sorted list) has 1 target, orientation 1, parity 1
            if remaining_cycles:
                shortest_cycle = remaining_cycles[-1]
                shortest_targets_len = len(shortest_cycle["targets"])
                shortest_ori = shortest_cycle["orientation"]
                shortest_parity = shortest_cycle["parity"]
                assert shortest_targets_len == 1, f"Expected shortest cycle to have 1 target, got {shortest_targets_len}"
                assert shortest_ori == 1, f"Expected shortest cycle orientation 1, got {shortest_ori}"
                assert shortest_parity == 1, f"Expected shortest cycle parity 1, got {shortest_parity}"
        except AssertionError as e:
            print(f"FAIL at scramble {i + 1}: {scram}")
            print(f"Error: {e}")
            print(f"Targets ({targets_count}): {result['targets']}")
            print(f"Flips ({flips_count}): {result['flips']}")
            print(f"Remaining cycles sorted: {remaining_cycles}")
            sys.exit(1)

    print(f"PASS: All {len(scrambles)} scrambles have 14 targets, 0 flips, and shortest cycle has 1 target with ori=1 parity=1")

if __name__ == "__main__":
    main()