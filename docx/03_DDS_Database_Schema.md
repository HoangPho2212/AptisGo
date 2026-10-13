# MongoDB Database Schemas (Data Design)

## Strategy
Tests embed question sets as sub-documents to optimize read locality during exam sessions[cite: 1]. Submissions link to Tests and Users by ObjectId reference and store granular evaluation arrays[cite: 1].

## 1. User Schema (`models/User.js`)
```javascript
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false }, // Hashed with bcrypt (salt factor 10)
  role: { type: String, enum: ['student', 'lecturer', 'admin'], default: 'student' },
  currentLevel: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'UNTESTED'], default: 'UNTESTED' }
}, { timestamps: true });