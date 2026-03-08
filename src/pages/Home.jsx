import React from 'react'

export const Home = ({ username }) => {
  return (
    <div>
      <p className='text-3xl h-329483'>Bem vindo(a), <span className='text-green-700'>{username}</span>!</p>
    </div>
  )
}
