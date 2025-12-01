# Tournament Rating System Guide

## Overview

This system implements a sophisticated rating calculation engine for ping pong tournaments, based primarily on the **USATT (USA Table Tennis) Rating System**. It provides flexible tournament configurations while maintaining mathematical accuracy in rating calculations.

## Table of Contents

1. [Rating System Types](#rating-system-types)
2. [USATT Algorithm Explained](#usatt-algorithm-explained)
3. [Tournament Configuration](#tournament-configuration)
4. [Rating Calculation Process](#rating-calculation-process)
5. [Administrative Controls](#administrative-controls)
6. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Rating System Types

### 1. USATT System (Recommended)
- **Purpose**: Official table tennis rating system used in tournaments
- **Characteristics**: 
  - Uses 4-pass calculation algorithm
  - Point exchange based on rating differences
  - Handles new players intelligently
  - Prevents rating deflation
- **Best for**: Official tournaments, competitive leagues

### 2. Elo Rating System
- **Purpose**: Chess-style rating system
- **Characteristics**:
  - Simpler calculation using K-factor
  - Immediate rating updates after each match
  - More volatile than USATT
- **Best for**: Casual tournaments, quick ratings

### 3. Custom Formula
- **Purpose**: Fully customizable rating rules
- **Characteristics**:
  - Define your own upset bonuses
  - Set minimum/maximum rating changes
  - Control point exchange rates
- **Best for**: Specialized tournament formats

---

## USATT Algorithm Explained

The USATT system uses a **4-pass algorithm** to ensure accurate ratings:

### Pass 1: Initial Calculation
- Processes matches for players with existing ratings
- Uses the Point Exchange Table (see below)
- Calculates preliminary new ratings

### Pass 2: New Player Integration
- Calculates initial ratings for unrated players
- Uses opponent ratings and win/loss records
- **Algorithm for new players**:
  - If wins > 0 AND losses > 0: Average of best win and worst loss
  - If all wins: Best opponent + bonus points
  - If all losses: Worst opponent - penalty points
  - If no valid opponents: Default to 1200

### Pass 3: Rating Refinement
- Applies point exchange table with Pass 2 ratings
- Ensures established players don't drop below initial ratings
- Handles rating constraints and bounds

### Pass 4: Final Calculation
- Final point exchange calculation
- Applies all safety constraints
- Produces final tournament ratings

### Point Exchange Table

Rating differences determine points exchanged between players:

| Rating Difference | Expected Result | Upset Result |
|------------------|----------------|--------------|
| 0-12 points      | 8 points       | 8 points     |
| 13-37 points     | 7 points       | 10 points    |
| 38-62 points     | 6 points       | 13 points    |
| 63-87 points     | 5 points       | 16 points    |
| 88-112 points    | 4 points       | 20 points    |
| 113-137 points   | 3 points       | 25 points    |
| 138-162 points   | 2 points       | 30 points    |
| 163-187 points   | 2 points       | 35 points    |
| 188-212 points   | 1 point        | 40 points    |
| 213-237 points   | 1 point        | 45 points    |
| 238+ points      | 0 points       | 50 points    |

**Example Calculation:**
- Player A (1500 rating) beats Player B (1400 rating)
- Rating difference: 100 points
- Expected result: A wins (higher rated)
- Points exchanged: 4 points
- New ratings: A = 1504, B = 1396

---

## Tournament Configuration

### General Settings

#### Rating System Selection
```javascript
{
  rating_system: 'usatt' | 'elo' | 'custom',
  initial_rating: 1200,        // Starting rating for new players
  provisional_threshold: 2,     // Matches needed for established rating
  rating_floor: 100,           // Minimum possible rating
  rating_ceiling: 3000,        // Maximum possible rating
  point_exchange_multiplier: 1.0 // Global multiplier for point exchanges
}
```

#### Tournament Options
- **Tournament Isolation**: Calculate ratings separately from league ratings
- **Reset Ratings**: Start all participants with initial rating
- **K-Factor (Elo only)**: Controls rating volatility (higher = more change)

### Advanced Settings (Custom System Only)

```javascript
{
  custom_rules: {
    upset_bonus: 5,           // Extra points for beating higher-rated players
    expected_penalty: 3,      // Points lost for expected results
    min_rating_change: 1,     // Minimum points per match
    max_rating_change: 50     // Maximum points per match
  }
}
```

---

## Rating Calculation Process

### 1. Match Completion Trigger
When a match is completed:
1. System retrieves all completed matches up to that point
2. Gets current player ratings from database
3. Runs appropriate calculation algorithm
4. Updates ratings atomically in database

### 2. Chronological Processing
- Matches are processed in chronological order
- Each match builds upon previous rating changes
- Ensures consistent rating progression

### 3. Safety Constraints
- **Rating Bounds**: Enforced by floor/ceiling settings
- **Provisional Players**: Flagged until threshold reached
- **Data Validation**: Ratings must be finite numbers between bounds
- **Atomic Updates**: All rating changes succeed or fail together

### 4. Tournament vs League Ratings

#### Shared Rating System (Default)
- Tournament matches affect league ratings
- Provides continuity across competitions
- Reflects overall player skill progression

#### Isolated Rating System
- Tournament has separate rating pool
- Useful for experimental formats
- Allows "what-if" scenarios

---

## Administrative Controls

### Manual Recalculation
Admins can trigger full rating recalculation:
- Recalculates all ratings from match history
- Useful after setting changes
- Maintains data integrity

### Rating System Changes
- Settings only affect future calculations
- Existing ratings remain unchanged
- Consider manual recalculation after major changes

### Monitoring & Validation
The system provides extensive validation:
- Rating bounds checking
- Finite number validation
- Database transaction safety
- Error logging and recovery

---

## Troubleshooting & FAQ

### Common Issues

#### Q: Player ratings seem too high/low
**A**: Check the point exchange multiplier and ensure proper rating system selection. USATT system typically produces more stable ratings than Elo.

#### Q: New players start with wrong ratings
**A**: Verify the initial_rating setting in tournament configuration. Default is 1200 for USATT system.

#### Q: Ratings not updating after matches
**A**: Check that matches are marked as "completed" and verify tournament is in "active" status. Only completed matches affect ratings.

#### Q: Rating changes seem inconsistent
**A**: USATT system uses 4-pass algorithm which can cause non-linear changes. Use manual recalculation to ensure consistency.

### Best Practices

1. **Choose Rating System Carefully**
   - USATT for official tournaments
   - Elo for casual play
   - Custom only for special requirements

2. **Set Appropriate Initial Ratings**
   - 1200 for USATT (standard)
   - Consider league average for continuing tournaments

3. **Use Tournament Isolation Sparingly**
   - Only for experimental formats
   - Breaks rating continuity

4. **Regular Monitoring**
   - Check rating distributions periodically
   - Watch for unusual rating inflation/deflation

5. **Backup Before Major Changes**
   - Settings changes affect future calculations
   - Consider impact on existing tournaments

---

## Technical Implementation Notes

### Database Structure
- `player_ratings` table stores current ratings per league
- `matches` table links to either seasons or tournaments
- `tournaments` table stores rating configuration in JSON settings field

### API Endpoints
- `POST /api/leagues/[slug]/ratings/recalculate` - Manual recalculation
- `PATCH /api/leagues/[slug]/tournaments/[tournamentSlug]` - Update settings

### Rating Update Flow
1. Match completed → `updateRatingsForMatch()` called
2. Fetch all relevant matches chronologically
3. Run calculation algorithm (USATT/Elo/Custom)
4. Validate results and update database atomically
5. Return rating changes for affected players

This system provides a robust, configurable foundation for tournament ratings while maintaining mathematical accuracy and data integrity.
