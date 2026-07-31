# The Archivist

The Archivist is the canonical wizard-head direction for Remora. It is a broad,
sleepy character with a low floppy hat and cloud-like beard, rendered entirely
in warm foreground neutrals for the application's dark interface.

The wizard is integrated into the generation command container as an inline
SVG puppet. It sits behind the top-right edge of the command surface and reacts
to nearby pointer movement with layered spring motion.

## Asset constraints

- Authored on a `128 × 128` view box and displayed at `48 × 48` in the product.
- Transparent background.
- Large filled shapes rather than fragile illustration detail.
- Warm chalk highlights, ivory midtones, soft stone shadows, and dark facial
  marks with no chromatic accent color.
- Independently addressable SVG groups for `head`, `eyes`, `beard`,
  `moustache`, `hat-brim`, `hat-crown`, and `hat-charm`.
- Each movable group includes a `data-physics-part` attribute for the eventual
  spring-motion prototype.

## Intended motion hierarchy

The head is the primary body. The crown follows it with a slight delay, while
the charm and beard behave as secondary bodies with different spring
characteristics:

`cursor → head → hat crown → charm`

`cursor → head → beard`

There is no idle loop. Motion begins when a mouse or pen enters the wizard's
72-pixel proximity field, preserves velocity through chained springs, and
settles naturally. Touch and reduced-motion experiences remain static.
