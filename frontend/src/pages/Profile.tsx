import React from 'react';

const Profile: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Profile</h1>
        <div className="card">
          <div className="card-content">
            <p className="text-muted-foreground">Profile management will be implemented here.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
