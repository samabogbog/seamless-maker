# Tilted lattice and edge compensation

Source reference: [Rotary main.js](https://github.com/samabogbog/Rotary/blob/main/main.js), blob `b706b3ab9efc39a3adf2760161244218358cf4f9`, reviewed through the connected GitHub API. The implementation is an ES3 lattice calculation tailored to Illustrator, not a copy of the web page's fixed 30 × 30 preview loops.

An instance center is `origin + column * h + row * v`, where `h=(HX,HY)` is the spacing vector **along a row**, and `v=(VX,VY)` is the spacing vector **along a column**. Symbol Rotation remains independent of these vectors. Positive Y goes down in panel coordinates.

## Top–Bottom

Inputs: tile height `H`, Vertical Steps `R`, integer Column Tilt `A`, and fixed, editable `HX` / `HY` in the selected measurement unit.

```
VX = HX * A / R
VY = (H + HY * A) / R
```

Thus `R*v - A*h = (0,H)`. Across the top/bottom seam the matching instance changes by **−A columns and +R rows**, rather than staying in the same column. Horizontal Steps is disabled here: the visible column count is determined by the fixed spacing and tile width. Width changes crop the lattice, without changing HX/HY.

Example corresponding to the supplied diagram: `HX=60`, `HY=15`, `H=480`, `R=8`, `A=-2` gives `v=(-15,56.25)`. From col1,row3 to col3,row11, `2*h + 8*v = (0,480)`. The two instances meet at identical X after clipping. Negative `A` moves each successive column-axis step left; negative `HY` tilts a row upward. HX may be negative, but must be nonzero.

## All Sides

Inputs: tile width/height `W,H`, Horizontal/Vertical Steps `C,R`, integer Row Cycles `U>=1`, integer Row Tilt `Q`, and integer Column Tilt `A`. Horizontal X/Y are **computed read-only**.

```
HX = W / C
HY = H * Q / (U * C)
VX = HX * A / R
VY = (H / U + HY * A) / R
```

`Q=1` reproduces Rotary's `calc4` exactly; `U` is Rotary's **Unit**, a repeat-cycle count rather than mm/cm/in/pt. Q extends the reference to zero and negative row tilt. Q=0, A=0, U=1 is a normal rectangular grid.

Two integer lattice translations guarantee the rectangular tile periods:

```
U*R*v - U*A*h                  = (0,H)
(C + Q*A)*h - Q*R*v            = (W,0)
```

The readout displays these matching column/row deltas. Arbitrary fractional compensation counts are rejected because they would break the exact rectangular periods. The number of lattice sites per tile area is `C*R*U`; changing U affects density as well as slope.

## Generation, clipping and performance

The generator scans the genuine infinite lattice inside the tile rectangle expanded by the transformed symbol bounds and a 1 pt margin. It uses inverse lattice coordinates to find the row range, then intersects each row with the expanded X/Y ranges to derive only necessary columns. It does not wrap a finite tilted grid independently, which would insert breaks in the row/column alignment.

Points carry zero-based `column` / `row` indices; negative indices represent necessary sites outside the chosen origin. A coordinate translation across a seam adds the displayed matching-index delta. The scan's row/column order is stable under these integer translations, including overlapping translucent instances.

Only intersecting SymbolItems are generated. Counts over 2,000 warn; counts over 10,000 stop before a large allocation. Pathological nearly horizontal/vertical skinny scans fail with an actionable tilt/spacing message instead of freezing the panel. Legacy Grid and Staggered Rows remain available and use their prior computation.
