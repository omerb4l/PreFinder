import { db } from '@/firebaseConfig';
import { doc, getDoc, collection, serverTimestamp, increment, writeBatch, updateDoc } from 'firebase/firestore';

/**
 * Verifies player presence in a lobby and updates statistics accordingly.
 * 
 * @param lobbyId ID of the lobby
 * @param leaderId UID of the lobby creator
 * @param playerId UID of the joining player
 * @param didJoin True if the player actually showed up, false if they were a no-show
 * @param requestId ID of the join request document
 */
export const verifyPlayerPresence = async (
  lobbyId: string,
  leaderId: string,
  playerId: string,
  didJoin: boolean,
  requestId: string
) => {
  try {
    const requestRef = doc(db, 'requests', requestId);

    if (didJoin) {
      const batch = writeBatch(db);

      // 1. Create a new document in match_history
      const matchHistoryRef = doc(collection(db, 'match_history'));
      batch.set(matchHistoryRef, {
        lobbyId,
        leaderId,
        playerId,
        timestamp: serverTimestamp(),
        leaderRated: false,
        playerRated: false,
      });

      // 2. Increment lobbiesJoined counter in the player's user document
      const playerUserRef = doc(db, 'users', playerId);
      batch.update(playerUserRef, {
        lobbiesJoined: increment(1)
      });

      // 3. Increment lobbiesCreated counter in the leader's user document (only once per lobby)
      if (lobbyId) {
        const lobbyRef = doc(db, 'lobbies', lobbyId);
        const lobbySnap = await getDoc(lobbyRef);

        if (lobbySnap.exists()) {
          const lobbyData = lobbySnap.data();
          if (!lobbyData.statsCounted) {
            const leaderUserRef = doc(db, 'users', leaderId);
            batch.update(leaderUserRef, {
              lobbiesCreated: increment(1)
            });

            // Mark statsCounted as true on the lobby so we don't count it again
            batch.update(lobbyRef, {
              statsCounted: true
            });
          }
        }
      }

      // 4. Update the request status to 'verified' so it is completed
      batch.update(requestRef, { status: 'verified' });

      await batch.commit();
    } else {
      // If didJoin is false, simply mark the request status as 'no-show' so it is dismissed and they can't rate
      await updateDoc(requestRef, { status: 'no-show' });
    }
  } catch (error) {
    console.error('Error verifying player presence:', error);
    throw error;
  }
};
