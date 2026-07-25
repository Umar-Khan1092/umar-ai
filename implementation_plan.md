# Notification Fixes and Enhancements

This plan addresses two issues:
1. Native push notifications on Android lack sound/vibration.
2. The "Enable Notifications" button needs to be seamlessly embedded next to the "Welcome" messages in the Admin, Teacher, and Guardian portals (replacing the floating global button), and should show a green tick if already enabled.

## Proposed Changes

### 1. Enable Push Notification Sounds
Modify the Firebase Admin payload in `src/app/api/push/send/route.ts` to include the explicit `android` block with high priority and default sound.

#### [MODIFY] [route.ts](file:///D:/educatitonERRP/app/src/app/api/push/send/route.ts)
Update `fcmMessage` payload:
```typescript
    const fcmMessage = {
      notification: {
        title: displayTitle,
        body: finalMessage,
      },
      android: {
        priority: "high",
        notification: {
          sound: 'default'
        }
      },
      data: {
        url: url || '/',
        category: category || 'general'
      },
      tokens: fcmTokens
    };
```

### 2. Extract Push Notification Logic to a Reusable Component
Create a new embedded `NotificationSubscribeButton` component that uses the existing `PushNotificationManager` logic but displays inline as a beautiful green button or a green checkmark if already subscribed.

#### [NEW] [NotificationButton.tsx](file:///D:/educatitonERRP/app/src/components/NotificationButton.tsx)
- Extract subscription state and logic.
- Render "🔔 Enable Notifications" or "✅ Notifications Enabled".

### 3. Embed Button in Portals and Remove Floating Button
Inject the `NotificationButton` directly into the page headers of the respective portals, and remove the floating UI from `PushNotificationManager`.

#### [MODIFY] [PushNotificationManager.tsx](file:///D:/educatitonERRP/app/src/components/PushNotificationManager.tsx)
- We will actually convert this file to purely export the reusable `NotificationButton` component and remove it from `layout.tsx` so it stops floating globally.

#### [MODIFY] [layout.tsx](file:///D:/educatitonERRP/app/src/app/layout.tsx)
- Remove `<PushNotificationManager />`.

#### [MODIFY] [page.tsx (Guardian)](file:///D:/educatitonERRP/app/src/app/(guardian)/guardian/page.tsx)
- Add `<NotificationButton />` next to "Welcome, Guardian!".

#### [MODIFY] [page.tsx (Teacher Profile)](file:///D:/educatitonERRP/app/src/app/(teacher)/teacher/profile/page.tsx)
- Add `<NotificationButton />` next to "Welcome, Teacher!".

#### [MODIFY] [page.tsx (Admin Dashboard)](file:///D:/educatitonERRP/app/src/app/(admin)/dashboard/page.tsx)
- Add `<NotificationButton />` next to "Dashboard".

## Verification Plan
- Build Next.js to ensure no syntax errors.
- Test that the button appears inline and correctly shows the checkmark when subscribed.