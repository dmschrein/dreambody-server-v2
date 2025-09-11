# dreambody-server-v2

curl -i -X POST "https://avi8afjcv1.execute-api.us-west-2.amazonaws.com/invoke" \
 -H "Content-Type: application/json" \
 -d '{
"connectionId": "QuIx2cOnPHcCEOA=",
"age": "32",
"sex": "male",
"metrics": "5'\''10\", 185 lb, ~20% body fat",
"experience": "2 years consistent lifting, beginner-intermediate",
"medical": "None",
"goals": "Lose ~10 lb in 12 weeks; maintain muscle",
"schedule": "4 days/week, 60 minutes",
"equipment": "Commercial gym",
"diet_preferences": "High-protein, no pork",
"diet_constraints": "Meal prep 2x/week, moderate budget",
"activity": "~7k steps/day",
"context": "travels monthly; 6–7h sleep",
"calorie_target": "2200",
"protein_g": "160",
"fat_g_min": "60"
}'
