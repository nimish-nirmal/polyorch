def format_turn(turn_number, total_turns, greeting):
    """Format a turn message with timestamp."""
    return f"[TURN {turn_number}/{total_turns}] {greeting} - turn {turn_number}"

def calculate_progress(current, total):
    """Calculate progress percentage."""
    return round((current / total) * 100, 1)
