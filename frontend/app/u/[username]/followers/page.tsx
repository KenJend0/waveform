import { notFound } from "next/navigation";
import FollowersList from "@/components/FollowersList";

interface FollowersPageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function FollowersPage({ params }: FollowersPageProps) {
  const { username } = await params;
  if (!username) {
    notFound();
  }

  return <FollowersList username={username} />;
}
