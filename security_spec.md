# Firestore Security Specification - Baking Recipe Box

## 1. Data Invariants

- **Ownership**: Every recipe MUST have a `uid` or `author_id` matching the authenticated user's UID.
- **Immutability**: Once a recipe is created, its `id` and `uid`/`author_id` cannot be changed by the user.
- **Validation**: All strings must have reasonable size limits to prevent abuse.
- **Relational Integrity**: Users can only manage their own settings and items.

## 2. The "Dirty Dozen" Payloads (Target: /recipes/{recipeId})

1. **Identity Spoofing**: `{"uid": "attacker_id", "title": "Stolen Recipe"}` (Auth as Victim) -> **DENIED**
2. **Ghost Field Poisoning**: `{"uid": "victim_id", "title": "Test", "isAdmin": true}` -> **DENIED** (via strict schema)
3. **ID Poisoning**: `{"id": "a".repeat(2000), "uid": "victim_id", ...}` -> **DENIED** (via isValidId)
4. **Denial of Wallet (Large String)**: `{"uid": "victim_id", "title": "a".repeat(100000)}` -> **DENIED**
5. **Unauthorized Update (Hijack)**: Update recipe owned by `A` with auth as `B`. -> **DENIED**
6. **Immutable UID Change**: Update existing recipe `{"uid": "user_1"}` to `{"uid": "user_2"}` -> **DENIED**
7. **Type Mismatch (Numeric Title)**: `{"uid": "user_1", "title": 123}` -> **DENIED**
8. **Orphaned Write (No UID)**: `{"title": "No Owner"}` -> **DENIED**
9. **PII Leak (Trying to read other's settings)**: Read `/userSettings/victim_uid` with auth as `attacker_uid` -> **DENIED**
10. **State Shortcut (Bypassing workflow)**: (N/A for this simple app, but applicable for future state machines)
11. **Shadow Array Injection**: `{"uid": "user_1", "ingredients": ["massive_string"]}` -> **DENIED** (via size checks)
12. **Timestamp Spoofing**: `{"createdAt": "2000-01-01T00:00:00Z"}` (client provided) -> **DENIED** (enforce request.time)

## 3. Test Runner (Draft Plan)
A `firestore.rules.test.ts` would be used to verify these scenarios using the `@firebase/rules-unit-testing` library.
