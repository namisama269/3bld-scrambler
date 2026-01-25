import json
from itertools import permutations

# Corner pieces (excluding UFR buffer at index 0)
CORNERS = [
    ["UFR", "RUF", "FUR"],  # index 0 - buffer, excluded
    ["UFL", "FUL", "LUF"],
    ["UBR", "BUR", "RUB"],
    ["UBL", "LUB", "BUL"],
    ["DFR", "FDR", "RDF"],
    ["DFL", "LDF", "FDL"],
    ["DBR", "RDB", "BDR"],
    ["DBL", "BDL", "LDB"],
]

# Parity algs: UF/UR edge buffer, UFR corner buffer, target X
PARITY_UF_UR_UFR_X = {
    "UBL": "R D' R2 U2 R U' R' F2 U' F2 R U' R2 D R2",
    "DBR": "U R2 U' R U R' F' R U R' U' R' F R2 U' R U'",
    "DBL": "U D' R F' R' U R U F U' F' U' F R' U2 D",
    "DFR": "U D R2 U' R2 U R2 D' R2 U R2 U' R2 U2",
    "UBR": "R U R' F' R U R' U' R' F R2 U' R' U'",
    "LUF": "R' U' R2 U R' D R U' D' R2 D R U D' R",
    "LDB": "R U D' R' F' R U R' U' R' F R2 U' R' U' R D R'",
    "LDF": "U D R U' R U R' F' R U R' U' R' F R2 U' R2 U' D'",
    "FUL": "D R D' R2 U F2 U' F2 R2 D R' D' R U' R' U R'",
    "FDL": "U2 D R' F R2 U' R' U' R U R' F' R U R' U D'",
    "FDR": "U R U' R U R' F' R U R' U' R' F R2 U' R2 U'",
    "RDF": "U2 R' F R2 U' R' U' R U R' F' R U R' U",
    "RUB": "R U R' U R U2 R2 F' R U R' U' R' F R2 U' R' U2 R",
    "UFL": "U' D R2 D' R2 U R D R' D' R U' R' U R'",
    "RDB": "R U D R' F' R U R' U' R' F R2 U' R' U' R D' R'",
    "BUR": "U' R' U2 R U R2 F R U R U' R' F' R U'",
    "BDL": "U' R' D' R U R' U' D R D' R D R' U R' D' R D R",
    "BDR": "U2 D' R' F R2 U' R' U' R U R' F' R U R' U D",
    "DFL": "U R2 D R U' R2 D' R2 U D R U R U' R' U2 R' D' R",
    "BUL": "U R' D R2 U' R' U R2 D' R2 U R U' R' U2",
    "LUB": "U R' U' R U R' F' R U R' U' R' F R2 U2",
}

def compose_algs(*algs):
    """Compose multiple algs into one."""
    return " ".join(algs)

def main():
    # Get all 7 non-buffer pieces (indices 1-7)
    pieces = CORNERS[1:]  # 7 pieces, each with 3 stickers

    result = {}

    # Generate all permutations of 3 pieces from 7
    piece_indices = list(range(7))  # 0-6 representing pieces 1-7

    for perm in permutations(piece_indices, 3):
        p1_idx, p2_idx, p3_idx = perm

        # For each piece permutation, try all 27 sticker combinations
        for s1 in range(3):
            for s2 in range(3):
                for s3 in range(3):
                    sticker1 = pieces[p1_idx][s1]
                    sticker2 = pieces[p2_idx][s2]
                    sticker3 = pieces[p3_idx][s3]

                    # Get the parity algs for each sticker
                    alg1 = PARITY_UF_UR_UFR_X.get(sticker1, "")
                    alg2 = PARITY_UF_UR_UFR_X.get(sticker2, "")
                    alg3 = PARITY_UF_UR_UFR_X.get(sticker3, "")

                    if alg1 and alg2 and alg3:
                        # Key format: "UFR sticker1 sticker2 sticker3"
                        key = f"UFR {sticker1} {sticker2} {sticker3}"
                        composed = compose_algs(alg1, alg2, alg3)
                        result[key] = composed

    print(f"Generated {len(result)} algs")

    # Write to JSON file
    with open("3parity_algs.json", "w") as f:
        json.dump(result, f, indent=2)

    print("Written to 3parity_algs.json")

if __name__ == "__main__":
    main()
