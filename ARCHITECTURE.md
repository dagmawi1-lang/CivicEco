# CivicEco Architecture

```text
React + Vite frontend
        |
        | /api
        v
Express backend
        |
        +--> Authentication
        +--> Community reports
        +--> Evidence
        +--> Collaboration
        +--> Notifications
        +--> Response plans
        +--> Measurement
        +--> Intelligence calculations
        |
        +--> Public environmental services
              - National Weather Service
              - USGS Water Data
```

## Intelligence flow

```text
Community observations
        |
        v
Severity + confirmations + evidence
        |
        +--> confidence
        +--> priority
        +--> temporal patterns
        +--> geographic hotspots
        +--> early-warning signals
        |
        v
Community response
        |
        v
Outcome measurement
```

The current intelligence engine uses explainable rules. It is not a trained machine-learning model.
