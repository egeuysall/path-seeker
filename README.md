# PathSeeker

PathSeeker is an AI-powered route planning app that optimizes multi-stop trips using voice input, smart presets, and routine detection.

## Overview

Users can say:

“I need to go to Target, UPS, the bank, Starbucks, and home before 6 PM.”

PathSeeker:
- Extracts destinations and time constraints
- Reorders stops for efficiency
- Accounts for traffic
- Provides optimized navigation

## Core Features

### Voice-First Input
- Natural language trip requests
- Hands-free interaction for driving

### Multi-Stop Optimization
- Reorders stops to minimize time and traffic
- Supports deadline constraints (e.g., “before 6 PM”)

### Presets (SQL-Backed)
- Save common routines (e.g., “Weekly groceries”)
- Quick access by weekday
- One-tap route generation

### Routine Detection
- Detects repeated travel patterns
- Prompts users to save recurring trips as presets

### Efficiency Metrics
- Estimated carbon footprint
- Time efficiency comparison
- Traffic exposure analysis

## Tech Stack (Planned)

Frontend:
- Next.js
- Custom HTML/CSS

Backend:
- Node.js / Next.js API routes
- SQL database (PostgreSQL or MySQL)

Integrations:
- Maps API (Google Maps or Mapbox)
- Traffic data API
- Speech-to-text API
- LLM API for natural language parsing

## Example Flow

Voice Input  
→ Parse destinations + constraints  
→ Optimize route  
→ Apply traffic data  
→ Return ordered stops + ETA  
→ Suggest preset if pattern repeats

## Team

SHS Hacks Team  
Cappy  
King  
Ege  

## Goal

Make daily driving faster, safer, and more efficient using AI.
