# Citizen Science Discovery Guide: Hunting for Planet X and Moving Objects

This guide provides volunteers, students, and citizen scientists with the exact methodologies used to discover asteroids, comets, brown dwarfs, and Planet X in SPHEREx multi-epoch near-infrared data.

---

## 1. How Objects Reveal Themselves

Astronomical objects in the universe move at very different relative speeds:
1. **Solar System Objects (Asteroids, Comets, Centaurs):** Move rapidly within days or weeks. Over 6 months, an asteroid will have moved completely out of the local SPHEREx field of view!
2. **Distant Planet X / Planet Nine:** At estimated orbital distances of $400 - 800\text{ AU}$, Planet X moves slowly ($10 - 50\text{ arcsec/year}$ primarily due to Earth parallax and orbital motion). In 6 months, it shifts by $5 - 25\text{ arcseconds}$ ($1 - 4\text{ SPHEREx pixels}$).
3. **Nearby Stars & Brown Dwarfs:** Orbit around the Milky Way Galaxy. Nearby objects show measurable **proper motion** ($0.5 - 10\text{ arcsec/year}$).
4. **Distant Stars & Galaxies:** Show zero perceptible motion over years.

---

## 2. Using the Blinker & Inverted Contrast

1. **Start the Video Loop:** Click **Play** on the SPHEREx Blinker. Set speed to $\sim 2.0\text{ fps}$.
2. **Toggle Inverted Mode:** Switch from **Normal** to **Inverted** mode.
   > **Pro Tip:** Human vision is substantially more sensitive to black dots moving on a white background than white dots moving on a dark background.
3. **Scan in Quadrants:** Focus on one quadrant of the image at a time rather than looking at the entire screen at once. Look for any point that jumps back and forth.

---

## 3. Difference Subtraction Mode (The Dipole Signature)

Switch the viewer mode to **Difference** ($I_{\text{Epoch 2}} - I_{\text{Epoch 1}}$):
- **Zero (Neutral Grey):** Static background stars disappear.
- **The Dipole Signature:** A moving object will produce a paired black/cyan hole (deficit at Epoch 1) and bright amber spot (excess at Epoch 2).
- **The Variable Star Signature:** If you see an isolated bright or dark circle with no paired opposite spot, it is a **Variable Star** (pulsating giant or eclipsing binary)!

---

## 4. Validating with the 102-Band Spectrum

Click directly on any moving candidate:
- If the spectrum is flat or peaks in Arrays 1–3, it is likely a regular low-mass star.
- If the spectrum is **nearly zero in Array 1 and surges into Array 6 ($4.5 - 5.0\,\mu\text{m}$)** with a dip at **$3.05\,\mu\text{m}$ (Water Ice)**, congratulations: you have spotted an ultra-cool **Y-Dwarf Brown Dwarf** or an icy outer solar system body!

---

## 5. Logging and Exporting Discoveries

1. Click **Export Blinking GIF** to download a shareable animation.
2. Click **Export CSV** to save candidate coordinates and motion rates.
3. Submit findings to the SPHEREx Science Team or share on Backyard Worlds talk boards.

