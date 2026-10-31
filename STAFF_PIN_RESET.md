# Staff Maintenance PIN – Reset Password

Staff Maintenance is locked with a PIN that the shop owner creates the first time it is opened.
If the owner forgets the PIN, it can be reset with this password:

```
KMU-Q4ZK-TZB6
```

Capital letters and spaces don't matter (`kmu-q4zk-tzb6` also works).

## How to reset a forgotten PIN

Either:

- **Staff Maintenance** lock screen → **Forgot PIN?** → enter the reset password, or
- **Admin** → **Staff Maintenance Lock** → **Reset PIN** → enter the reset password.

The old PIN is cleared, and the next visit to Staff Maintenance asks the owner to create a new PIN.

## Note

This repository is public, so anyone who finds this file can reset the Staff PIN on a PC running
Zerivo. To change the password, generate a new scrypt hash and replace `RESET_PASSWORD_HASH` in
`electron/staffLock.js` (it only takes effect in the next build):

```
node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');console.log(s+':'+c.scryptSync('NEW-PASSWORD-IN-CAPITALS',s,32).toString('hex'))"
```
