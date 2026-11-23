import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { useAuth } from '../context/AuthContext';
import { ApiError, roomsApi } from '../lib/api/client';

export const JoinRoomPage: React.FC = () => {
  const { code = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    let active = true;
    setError(null);
    roomsApi.joinRoomByInviteCode(code)
      .then((room) => {
        if (active) {
          navigate('/study-rooms', {
            replace: true,
            state: {
              joinedRoomId: room.id,
              joinedRoom: room,
              successMessage: `You joined ${room.name}.`,
            },
          });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          if (cause instanceof ApiError && cause.status === 409) {
            setError('Room is full');
          } else if (cause instanceof ApiError && cause.status === 404) {
            setError('Invalid link');
          } else {
            setError(cause instanceof Error ? cause.message : 'Unable to join this study room.');
          }
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, code, navigate, user]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-dream-bg dark:bg-[#130E26] p-4 sm:p-8">
        <Card role="status" className="mx-auto max-w-xl p-6 text-sm text-muted-purple">
          Checking your session...
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ message: 'Please log in first to join this study room.' }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-dream-bg dark:bg-[#130E26] p-4 sm:p-8">
      <Card
        role={error ? 'alert' : 'status'}
        className="mx-auto max-w-xl space-y-3 p-6 text-sm text-muted-purple"
      >
        {error ? (
          <>
            <p className="text-rose-600">{error}</p>
            <Link to="/study-rooms" className="font-semibold text-primary">
              Browse study rooms
            </Link>
          </>
        ) : 'Joining your study room...'}
      </Card>
    </main>
  );
};
