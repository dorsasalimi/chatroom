import fetch from "node-fetch";

export async function graphqlRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  token?: string
): Promise<T> {
  const response = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query, variables }),
  });

  let json: any;

  try {
    json = await response.json();
  } catch (err) {
    console.error("❌ Failed to parse GraphQL response JSON:", err);
    throw new Error("Failed to parse GraphQL response.");
  }

  if (!response.ok || json.errors) {
    console.error("❌ GraphQL request failed:", {
      status: response.status,
      errors: json.errors,
      response: json,
    });
    throw new Error(
      `GraphQL request failed: ${response.statusText} - ${JSON.stringify(
        json.errors || json
      )}`
    );
  }

  if (!json.data) {
    throw new Error("❌ GraphQL response missing 'data'");
  }

  return json.data;
}
