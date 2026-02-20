import { notFound } from "next/navigation";
import FollowingList from "@/components/FollowingList";

interface FollowingPageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function FollowingPage({ params }: FollowingPageProps) {
  const { username } = await params;
  if (!username) {
    notFound();
  }

  return <FollowingList username={username} />;
}
