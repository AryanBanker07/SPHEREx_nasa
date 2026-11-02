"""
SPHEREx Time-Domain Sky Explorer - Launcher.
Runs the FastAPI backend and serves the interactive citizen science frontend.
"""

import sys
import webbrowser
import uvicorn

def main():
    port = 8000
    host = "127.0.0.1"
    url = f"http://{host}:{port}"
    print("=" * 70)
    print(" NASA SPHEREx Time-Domain Sky Explorer")
    print(" Planet X, Brown Dwarf & Variable Star Hunter")
    print(f" Serving live application at: {url}")
    print("=" * 70)
    
    # Optionally open browser
    try:
        webbrowser.open(url)
    except Exception:
        pass

    uvicorn.run("backend.app:app", host=host, port=port, reload=True)

if __name__ == "__main__":
    main()

