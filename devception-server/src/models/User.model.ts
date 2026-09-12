import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  password?: string;
  displayName: string;
  avatarUrl: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredLanguages: string[];
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    timesImposter: number;
    tasksCompleted: number;
    bugsInjected: number;
    xp: number;
    level: number;
  };
  cosmetics: {
    selectedSkin: string;
    ownedSkins: string[];
    selectedHat: string;
    ownedHats: string[];
  };
  learningProfile?: {
    skillAreas: {
      arrays: number;
      loops: number;
      recursion: number;
      edgeCases: number;
      stringManipulation: number;
      debugging: number;
    };
    averageSolveTimeSec: number;
    commonMistakes: string[];
    mistakeFrequencies: Record<string, number>;
    totalAttempts: number;
    totalCompletions: number;
    recentWeakness: string;
    updatedAt: Date;
  };
  createdAt: Date;
  lastSeen: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, select: false },
    displayName: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    skillLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    preferredLanguages: { type: [String], default: ['javascript'] },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      timesImposter: { type: Number, default: 0 },
      tasksCompleted: { type: Number, default: 0 },
      bugsInjected: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
    },
    cosmetics: {
      selectedSkin: { type: String, default: 'default' },
      ownedSkins: { type: [String], default: ['default'] },
      selectedHat: { type: String, default: 'none' },
      ownedHats: { type: [String], default: [] },
    },
    learningProfile: {
      skillAreas: {
        arrays: { type: Number, default: 70 },
        loops: { type: Number, default: 70 },
        recursion: { type: Number, default: 60 },
        edgeCases: { type: Number, default: 55 },
        stringManipulation: { type: Number, default: 70 },
        debugging: { type: Number, default: 60 },
      },
      averageSolveTimeSec: { type: Number, default: 90 },
      commonMistakes: { type: [String], default: [] },
      mistakeFrequencies: { type: Map, of: Number, default: {} },
      totalAttempts: { type: Number, default: 0 },
      totalCompletions: { type: Number, default: 0 },
      recentWeakness: { type: String, default: 'none' },
      updatedAt: { type: Date, default: Date.now },
    },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

// Ensure indexes (googleId unique, email unique) are created on Atlas.
User.createIndexes().catch(() => { /* non-fatal */ });
