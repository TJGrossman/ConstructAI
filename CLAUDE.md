# ConstructAI - Contractor Communication & Estimation Platform

## Problem Statement
Contractors struggle with client communication and staying on budget/time because:
- They work on job sites (phone/text communication, not at computers)
- Excellent at their craft, but documentation isn't their strength
- Homeowner change requests get lost or captured informally (verbal, paper)
- Change orders stack up without recalculating overall cost/time implications
- Projects appear way over budget when changes are only brought up one-by-one

## Solution Overview
Friction-free documentation platform with AI-powered voice-to-text and natural language processing:

### Core Features (MVP)
1. **Estimates via Voice Dictation**
   - Contractor dictates in natural language
   - AI converts to structured estimates based on contractor's service profile

2. **Service Profile Setup**
   - Natural language chat with AI to configure services, pricing, charging methods

3. **Change Order Capture**
   - SMS integration (app as middleman between contractor/client, full transaction log)
   - Voice dictation with summaries/approvals via SMS (dated/timestamped)
   - AI converts natural language to official change orders
   - Updates original estimates with version control
   - Shows time/cost implications of each change

4. **Work Tracking**
   - Dictate work completed in natural language
   - Reconciles against estimate + change orders
   - Receipt uploads

## Current Technical State
- **Stack**: Web application (need to confirm: Next.js? React? Backend?)
- **Current UI**: Desktop-focused with persistent left-hand sidebar
- **Service Setup**: Click-to-add interface (needs to become voice dictation)

## Mobile/Voice-First UX Vision
**Goal**: Completely frictionless mobile experience for contractors on job sites

**Approach**:
- Progressive Web App (PWA) - save webpage to phone home screen
- NOT building separate native mobile app
- Remove/adapt left-hand sidebar for mobile responsiveness
- Voice dictation throughout (estimates, services, work tracking, change orders)

## Design Requirements
**Look & Feel**: Clean, modern, dark mode
- Professional dark theme (slate background, construction orange accents)
- High contrast for readability on job sites (bright sunlight)
- Appeals to contractors and customers alike
- Touch-friendly interface with clear visual feedback

## Key Design Principles
1. **Mobile-first**: Contractors are on-site all day with phones, not laptops
2. **Voice-first**: Hands are busy building, voice is the natural interface
3. **Zero friction**: Every interaction should be as easy as a phone call
4. **Transparency**: Full audit trail for contractor and client (prevent disputes)
5. **Intelligence**: AI handles unstructured → structured conversion

## Questions to Answer During Development
- Current tech stack details?
- Database schema for estimates/change orders/services?
- Voice-to-text service (Web Speech API, Whisper, other)?
- SMS integration approach (Twilio, other)?
- Authentication system for contractors/clients?

---
*Last updated: 2026-02-12*
