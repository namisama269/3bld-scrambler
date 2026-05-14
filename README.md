# 3BLD Scrambler

A scramble generator for 3x3 blindfolded solving practice. Produces targeted scrambles for specific case types (comms, parity, floating, twists, flips, 2-swaps) so you can drill exactly what you need.

## Getting Started

```bash
npm install
npx vite        # dev server
npx vite build  # production build
```

Press **Spacebar** to generate a scramble quickly (when not focused on an input).

---

## Settings

### Buffer Order

Drag and drop to reorder. The first position is your active buffer.

- **Corner**: UFR is locked as the active buffer (position 0).
- **Edge**: UF and UR must occupy the first two positions (active + parity buffer). Their relative order is preserved.

### BLD Orientation

How you hold the cube during solves (e.g., White/Green = white on top, green in front). Affects the cube visualization and scramble orientation.

### Target Order

Controls how pieces appear in multiselect lists:
- **By piece** - grouped by physical piece
- **By face (Speffz)** - ULFRBD face ordering

### Show Cube

Toggle the 3D cube visualization on or off.

---

## Scramble Types

Both corners and edges have independent scramble type selectors. The available types differ slightly between sides.

### Solved

No settings. That side of the cube will be solved (or absorb a parity swap if the other side requires it).

### Random

Generates a random permutation for that side.

- **Parity**: Any / Even / Odd - constrain whether the random state has even or odd permutation parity.

### Targets

Generates a specific number of targets (commutator cycles) for that side.

- **Target count**: 1-8 (corners) or 1-12 (edges).
- **Parity targets** (advanced, odd count only): Which pieces are eligible as the dangling parity target.

### Twist (corners only)

Twists corners in place without permuting them, plus optional extra commutator targets.

- **Number of twists**: 1-7 non-buffer corners to twist.
- **Direction** (2+ twists): Same (all CW or all CCW) or Mixed.
- **Extra targets**: 0 to (7 - twist count) additional commutator cycle targets.
- **Twist targets** (advanced): Which corners (U/D sticker) are eligible for twisting.
- **Parity targets** (advanced, odd extras only): Which pieces are eligible as the parity target.

### Flips (edges only)

Flips edges in place without permuting them, plus optional extra commutator targets.

- **Number of flips**: 1-10 non-buffer edges to flip.
- **Extra targets**: 0 to (11 - flip count) additional cycle targets.
- **Flip targets** (advanced): Which edges are eligible for flipping.
- **Parity targets** (advanced, odd extras only): Which pieces are eligible as the parity target.

### 2-Swap

Generates a two-cycle (swap) between two pieces, plus extra commutator targets.

- **Mode**: Unoriented (T2C for corners, F2E for edges) or Oriented.
- **Extra targets**: 0, 2, 4, or 6 (corners) / 0, 2, 4, 6, 8, or 10 (edges).
- **First piece** (advanced): Which pieces can be selected as the first piece of the swap.
- **Only later buffers** (advanced): Restricts first-piece selection to pieces later in the buffer order.

Edge 2-Swap requires UF or UR as the active edge buffer.

### Floating

Generates a closed cycle that does *not* pass through the active buffer, simulating "floating" buffer scenarios. Implemented by chaining J-perm setups.

- **Floating buffers**: Select one or more buffers from positions 1 onward in the buffer order (excludes the active buffer and the last 2 positions).
  - **1 buffer selected**: You choose the exact target count.
  - **2+ buffers selected**: A buffer is picked each generation (equal or weighted distribution), and the target count is set automatically.
- **Distribution** (2+ buffers): Equal (uniform random) or Weighted (proportional to the number of sticker-pair cases at each buffer position). Pick rates are displayed when weighted.
- **Target count** (1 buffer): Number of targets in the floating cycle.
- **Add twisted corner / Add flipped edge** (1 buffer): Includes an additional misoriented piece alongside the cycle.
- **Parity swap** (1 buffer, odd target count): Controls where the residual parity swap lands:
  - **Edge (UF/UR)** - the swap appears as a UF/UR edge swap.
  - **Corner (UFR/UBR)** - the swap appears as a UFR/UBR corner swap.

---

## Parity Rules

When both sides force a specific permutation parity, those parities must agree (both even or both odd). The app validates this and shows an error if they conflict.

Types that force a parity: Targets (based on count), Twist (based on extra count), Flips (based on extra count), 2-Swap (always odd for corners), Floating with 1 buffer (based on target count).

Types that are parity-flexible: Solved, Random with parity set to Any, Edge 2-Swap.

---

## Preset Copy / Paste

Each scramble card (Corner and Edge) has copy and paste buttons in the header.

- **Copy**: Encodes the current type and its settings into a shareable string. Only the settings relevant to the active type are included - it won't overwrite your settings for other types.
- **Paste**: Reads a preset string from the clipboard and applies it. Rejects strings from the wrong side (e.g., pasting a corner preset into the edge card shows an error).

Preset strings look like `3bld:corner:1:eyJ...` and are safe to share in chat, notes, etc.

---

## Output

- **Generate scramble**: Produces a single scramble and renders the cube.
- **Generate bulk**: Produces multiple scrambles (1-9999) with a progress bar. Results are listed and can be scrolled.
- **Debug**: Shows the engine's internal state - buffer assignments, applied algorithms, cycle structure, and DLin tracing.
