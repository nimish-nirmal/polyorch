import json
import time
import os
from datetime import datetime

def main():
    greeting = os.environ.get("GREETING", "Hello World")
    turns = int(os.environ.get("TURNS", "5"))
    interval_seconds = float(os.environ.get("INTERVAL_SECONDS", "1"))
    
    print(f"[INFO] Starting Hello World Turns pipeline")
    print(f"[INFO] Greeting: {greeting}")
    print(f"[INFO] Number of turns: {turns}")
    print(f"[INFO] Interval: {interval_seconds:g} seconds")
    print(f"[INFO] Start time: {datetime.now().isoformat()}")
    print("")
    
    for i in range(1, turns + 1):
        print(f"[TURN {i}/{turns}] {greeting}!")
        print(f"[TURN {i}/{turns}] Processing turn {i} of {turns}")
        
        if i < turns:
            print(f"[TURN {i}/{turns}] Waiting {interval_seconds:g} seconds before next turn...")
            time.sleep(interval_seconds)
        else:
            print(f"[TURN {i}/{turns}] Final turn completed")
    
    print("")
    print(f"[INFO] All {turns} turns completed successfully")
    print(f"[INFO] End time: {datetime.now().isoformat()}")
    print(f"[SUCCESS] Hello World Turns pipeline finished")
    return 0

if __name__ == "__main__":
    exit(main())
