import wixData from 'wix-data';

export async function cleanupOldMessages() {
    console.log("Starting cleanup of old SlaveMessages…");

    // 1. Get all unique member IDs
    const members = await wixData.query("SlaveMessages")
        .distinct("memberId");

    const memberIds = members.items || [];

    for (const memberId of memberIds) {
        console.log(`Cleaning messages for member: ${memberId}`);

        // 2. Fetch all messages for this member, newest first
        const result = await wixData.query("SlaveMessages")
            .eq("memberId", memberId)
            .descending("_createdDate")
            .limit(1000) // enough for most cases
            .find();

        const messages = result.items;

        if (messages.length <= 50) {
            console.log(`Member ${memberId} has ${messages.length} messages — nothing to delete.`);
            continue;
        }

        // 3. Keep the first 50, delete the rest
        const toDelete = messages.slice(50);

        console.log(`Deleting ${toDelete.length} old messages for ${memberId}`);

        for (const msg of toDelete) {
            await wixData.remove("SlaveMessages", msg._id);
        }
    }

    console.log("Cleanup complete.");
}
