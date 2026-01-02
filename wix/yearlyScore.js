import wixData from 'wix-data';

export const invoke = async ({ payload }) => {
  // Fetch all items from the "Tasks" collection
  const results = await wixData.query("Tasks").find();

  // Filter out invalid items
  const validItems = results.items.filter(item => item && item._id);

  // Sort by yearlyScore descending and take top 3
  const topThree = [...validItems]
    .sort((a, b) => b.yearlyScore - a.yearlyScore)
    .slice(0, 3);

  const entry = {
      name1: topThree[0]?.title_fld || null,
      score1: topThree[0]?.yearlyScore || 0,
      name2: topThree[1]?.title_fld || null,
      score2: topThree[1]?.yearlyScore || 0,
      name3: topThree[2]?.title_fld || null,
      score3: topThree[2]?.yearlyScore || 0,
  };

  // Insert the single row into yearlyTopScores
  await wixData.insert("YearlyLeaderboard", entry);
  
  // Reset yearlyScore to 0 for each valid item
  const updatedItems = validItems.map(item => {
    item.yearlyScore = 0;
    return item;
  });

  // Update all items in the collection
  const updateResults = await Promise.all(
    updatedItems.map(item => wixData.update("Tasks", item))
  );

  console.log("Top 3 saved:", topThree);
  console.log("Update results:", updateResults);

  return {};
};