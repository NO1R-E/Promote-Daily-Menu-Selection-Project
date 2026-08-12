# Promote Daily Menu Selection Project
This project is part of a Project Management and Digital Startup (01418371)

A cross-platform mobile application that provides personalized meal recommendations.
The system is designed to solve dietary decision fatigue by algorithmically balancing a user's macronutrient/micronutrient requirements with their taste preferences.

## Core functions
User Profiling: Captures physical metrics, dietary goals (e.g., weight loss, hypertrophy), allergies, and taste preferences.
Meal Tracking: Calculates daily macronutrient and micronutrient consumption against target baselines.
Algorithmic Recommendations: Recommends meals based on remaining daily nutritional allowance and historical preference data.
AI Integration: Chatbot interface for nutritional queries and ingredient substitutions.
Community System: Supports user-generated recipes, meal ratings, and forum interactions.

## Tech Stack & Architecture
__Frontend__\n
React Native & Expo: Cross-platform mobile client for iOS and Android.\n
__Backend & API__\n
Python: Core logic and algorithmic calculations for the recommendation engine.\n
FastAPI: High-performance RESTful API infrastructure.\n
__Database & Authentication__\n
PostgreSQL: Relational database managing 22+ tables (users, meals, logs, community interactions).\n
Supabase: Backend-as-a-service for PostgreSQL hosting, real-time data sync, and secure authentication.\n
__Deployment__\n
Render: Cloud hosting for FastAPI backend services.\n

## Solving
Cold Start Problem is one of the challenges of building recommendation system, so we use ELIXIR algorithm instead\n
Result: The system provides health-optimized meal recommendations immediately upon account creation.
