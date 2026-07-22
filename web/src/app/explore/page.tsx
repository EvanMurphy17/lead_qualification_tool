import { getSession } from "@/lib/auth";
import { ExploreApp } from "@/components/explore/ExploreApp";

export default async function ExplorePage() {
  const session = await getSession();
  return <ExploreApp preview={!session} />;
}
