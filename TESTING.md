# CivicEco Testing Checklist

Run:

```bash
npm install
npm run lint
npm run build
npm run server
```

Then verify:

- `GET /api/health` returns `ok: true`.
- Sign up with a new account.
- Log in and log out.
- Create a report.
- Attach evidence.
- Confirm an issue once.
- Follow and unfollow an issue.
- Comment on an issue.
- Check notifications.
- Join a response.
- Complete a response task.
- Add a measurement check-in.
- Open the map and switch time windows.
- Open Insights.
- Open Community Center.
- Test on a narrow mobile viewport.
- Test keyboard navigation and visible focus.
- Test an API error and confirm a useful message is shown.

Do not use real passwords, private addresses, or sensitive personal information during testing.
