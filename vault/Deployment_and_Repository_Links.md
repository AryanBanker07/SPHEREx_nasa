# SPHEREx Sky Explorer: Deployment & Repository Links

**Challenge:** NASA Space Apps Challenge 2026 — Planet X and SPHEREx  
**Last Updated:** 2026-11-02  

---

## 🔗 Live Deployments & Repository

| Destination | URL / Link | Description |
| :--- | :--- | :--- |
| **GitHub Repository** | [https://github.com/AryanBanker07/SPHEREx_nasa](https://github.com/AryanBanker07/SPHEREx_nasa) | Full source code with backend, frontend, test suites, and documentation. |
| **Production Live Site** | [https://frontend-three-teal-18.vercel.app](https://frontend-three-teal-18.vercel.app) | Publicly accessible interactive web application deployed on Vercel. Includes full client-side simulation engine. |
| **Local Development Server** | `http://127.0.0.1:8000` | Full-stack server running FastAPI + Astropy scientific engine locally. |

---

## 🚀 How to Run Locally

```bash
cd "c:\Users\banke\OneDrive\Desktop\nasa_spaceapps\Planet X and SPHEREx"
python run.py
```
This automatically boots Uvicorn on `http://127.0.0.1:8000` and opens the web application in your default browser.

---

## 🛠️ Deployment Configuration

- **Vercel Static & Client-Side Engine:** The frontend incorporates an in-browser scientific simulation generator. If deployed to any CDN or static hosting platform without the Python backend, all 5 benchmark targets (Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, R Draconis) and custom coordinate queries simulate the multi-epoch blinking, difference subtraction, dipole detection, and 102-band spectrophotometric SED extraction with zero external server dependencies.
- **FastAPI / Astropy Server:** When connected to the Python backend, it connects live to `astropy.coordinates.SkyCoord`, WCS headers, and automated matrix math.
