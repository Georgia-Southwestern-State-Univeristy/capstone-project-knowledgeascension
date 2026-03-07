
# Knowledge Ascension – Testing Report

## Project
Knowledge Ascension  
Capstone Project – Milestone 3  
Midterm Progress Check

## Testing Objective
The goal for this test report is to verify that the core features currently implemented in Knowledge Ascension function correctly, handle invalid input appropriately and support stable user interaction across the system. Testing focused on core flows, edge cases, negative cases and error handling.

## Test Environment
- Frontend: React + Vite
- Backend: Node.js / Express or FastAPI
- Database: MySQL / PostgreSQL
- Browser: Google Chrome
- OS: Windows
- Branch Tested: main

## Test Summary
A total of 8 test cases were executed for Milestone 3.

- Passed: 7
- Failed: 1
- In Progress: 0

---

## Detailed Test Cases

| Test ID | Test Type | Feature | Test Scenario | Expected Result | Actual Result | Status |
|--------|-----------|---------|---------------|-----------------|---------------|--------|
| TC-01 | Core Flow | User Login | User enters valid username/email and password | User is authenticated and redirected to dashboard | Login successful and dashboard displayed | Pass |
| TC-02 | Negative Test | User Login | User enters incorrect password | System denies access and displays error message | Invalid login rejected with message | Pass |
| TC-03 | Core Flow | Start Game Session | Authenticated user starts a new game | Game session created and displayed | Session started correctly | Pass |
| TC-04 | Core Flow | Question Retrieval | System retrieves quiz questions from backend/database | Questions appear in game interface | Questions loaded successfully | Pass |
| TC-05 | Persistence Test | Score Saving | User finishes game and submits score | Score stored in database and persists after refresh | Score saved and remained after reload | Pass |
| TC-06 | Edge Case | Input Validation | User submits form with missing fields | System prevents submission and shows validation message | Validation warning displayed | Pass |
| TC-07 | Error Handling | API/Database Failure | Backend/database becomes unavailable | System displays clear error message | Error shown but message unclear | Fail |
| TC-08 | Core Flow | Leaderboard Display | User views leaderboard after scores recorded | Leaderboard shows stored scores sorted correctly | Leaderboard displayed correctly | Pass |

---

## Required Coverage Check

This testing report includes:
- Core feature flow tests (login, game session, question retrieval, leaderboard)
- Edge case test (empty input validation)
- Negative test case (invalid login)
- Error-handling test (backend/API failure)

---

## Bugs Identified

### Bug 1: Unclear Error Message During API/Database Failure
- Related Test Case: TC-07
- Description: When backend or database connectivity fails the error message displayed to the user is unclear.
- Impact: Users may not understand the cause of the failure.
- Recommended Fix: Improve frontend error handling and standardize backend error responses.
- Suggested GitHub Issue: `bugfix/improve-api-error-handling`

---

## Overall Assessment

The system demonstrates that the major core flows are functional, including authentication, session creation, live question retrieval, score persistence and leaderboard display. Most tested features are operating as expected. The primary weakness identified is inconsistent error messaging when backend or database failures occur.

---

## Next Testing Priorities

For the next sprint the team will focus on:

- Authentication edge cases
- Duplicate account handling
- Leaderboard sorting verification
- Session timeout behavior
- Unauthorized access attempts
- Performance testing for slow API/database operations
