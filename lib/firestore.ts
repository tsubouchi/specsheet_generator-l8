import { getFirestore } from "firebase/firestore"
import { app } from "@/lib/firebase"

export const clientDb = getFirestore(app) 