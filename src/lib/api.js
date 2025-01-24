const BASE_URL = "https://aleph.occrp.org/api/2";
const API_KEY = "YOUR_API_KEY_HERE";


export async function fetchEntities(query, schema, limit = 10, filters = {}, offset = 0) {
    const url = `${BASE_URL}/entities`;

    const params = new URLSearchParams({
        q: query,
        "filter:schema": schema,
        limit: limit.toString(),
        offset: offset.toString(),
        ...Object.fromEntries(
            Object.entries(filters).map(([key, value]) => [`filter:${key}`, value])
        ),
    });

    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            headers: {
                Authorization: `ApiKey ${API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to search entities: HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.results || !Array.isArray(data.results)) {
            throw new Error("Invalid response format: expected 'results' array.");
        }

        return data;
    } catch (error) {
        console.error("Error fetching entities:", error);
        throw error;
    }
}


export async function fetchConnectedEntities(entityId, limit = 10, filters = {}) {
    const url = `${BASE_URL}/entities/${entityId}/expand`;

    const params = new URLSearchParams({
        limit: limit.toString(),
        ...Object.fromEntries(
            Object.entries(filters).map(([key, value]) => [`filter:${key}`, value])
        ),
    });

    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            headers: {
                Authorization: `ApiKey ${API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch connected entities: HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== "ok" || !Array.isArray(data.results)) {
            console.error("Unexpected response format:", data);
            return [];
        }

        return data.results.map((item) => {
            const propertyName = item.property;

            console.log(item)
            const entities = (item.entities || []).map((entity) => ({
                property: propertyName,
                schema: entity.schema || "Unknown Type",
                label:
                    entity.properties?.name?.[0] ||
                    entity.label ||
                    entity.properties?.title?.[0] ||
                    entity.properties?.full?.[0] ||
                    entity.properties?.namesMentioned?.[0] ||
                    entity.properties?.entity?.[0] ||
                    entity.properties?.description?.[0] ||
                    entity.properties?.alias?.[0] ||
                    entity.properties?.member?.[0] ||
                    "No Label",
                id: entity.id || "Unknown ID",
            }));

            return { property: propertyName, entities };
        });
    } catch (error) {
        console.error("Error fetching connected entities:", error);
        throw error;
    }
}

export async function fetchSimilarEntities(entityId, filters = {}) {
    const url = `${BASE_URL}/entities/${entityId}/similar`;

    const params = new URLSearchParams({
        ...Object.fromEntries(
            Object.entries(filters).map(([key, value]) => [`filter:${key}`, value])
        ),
    });

    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            headers: {
                Authorization: `ApiKey ${API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch similar entities: HTTP ${response.status}`);
        }

        const data = await response.json();


        if (!data.results || !Array.isArray(data.results)) {
            console.error("Unexpected response format:", data);
            throw new Error("Unexpected response format: 'results' should be an array.");
        }


        return data.results.map((item) => {
            const entity = item.entity || {};
            return {
                id: entity.id || "Unknown ID",
                label:
                    entity.properties?.name?.[0] ||
                    entity.label ||
                    entity.properties?.title?.[0] ||
                    entity.properties?.full?.[0] ||
                    entity.properties?.namesMentioned?.[0] ||
                    entity.properties?.entity?.[0] ||
                    entity.properties?.description?.[0] ||
                    entity.properties?.alias?.[0] ||
                    entity.properties?.member?.[0] ||
                    "No Label",
                schema: entity.schema || "Unknown Type",
                relation: "similar",
            };
        });
    } catch (error) {
        console.error("Error fetching similar entities:", error);
        throw error;
    }
}
