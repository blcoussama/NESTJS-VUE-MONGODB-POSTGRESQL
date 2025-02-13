/* eslint-disable react/prop-types */

const AppLayout = ({ children }) => {
  return (
    <main className='flex items-center justify-center bg-gradient-to-br from-gray-900 to-black'>
        {children}
    </main>
  )
}

export default AppLayout