import fetch from "node-fetch";

export async function graphqlRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  token?: string
): Promise<T> {
  const response = await fetch("http://localhost:3000/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors) {
    console.error("GraphQL errors:", json.errors);
    throw new Error(JSON.stringify(json.errors));
  }

  // Return ONLY the "data" part, so caller receives `{ users: [...] }` etc.
  return json.data;
}
