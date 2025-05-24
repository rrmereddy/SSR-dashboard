"use client";
import React from 'react';
const Dashboard = () => {

  return (
    <section className="h-screen w-full flex" style={{ backgroundColor: '#e8d5b9' }}>
    <div className="size-full grid gap-4 grid-rows-4 grid-cols-10 p-4">
      <div className="col-span-5 row-span-2 center rounded-3xl p-4 shadow-lg" style={{ backgroundColor: '#d9c6a8', border: '2px solid #b39f84' }}>
        <span style={{ color: '#5c4a32' }}>GitHub stuff</span>
      </div>
      <div className="flex flex-col col-span-5 row-span-3 center rounded-3xl p-2 shadow-lg" style={{ backgroundColor: '#d9c6a8', border: '2px solid #b39f84' }}>
        <div className="w-full mt-10">
          <span style={{ color: '#5c4a32' }}>Leetcode</span>
        </div>
      </div>
      <div className="col-span-5 row-span-1 center rounded-3xl p-4 shadow-lg" style={{ backgroundColor: '#d9c6a8', border: '2px solid #b39f84' }}>
        <span style={{ color: '#5c4a32' }}>Implement Collaboration Feature</span>
      </div>
      <div className="col-span-10 row-span-4 center rounded-3xl p-4 shadow-lg" style={{ backgroundColor: '#d9c6a8', border: '2px solid #b39f84' }}>
        <span style={{ color: '#5c4a32' }}>Implement Chat Feature</span>
      </div>
    </div>
  </section>
  );
};

export default Dashboard;