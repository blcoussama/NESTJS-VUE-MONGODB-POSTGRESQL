
const AppLayout = ({ children }) => {
  return (
    <main className='fixed inset-0 flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black'>
        {children}
    </main>
  )
}

export default AppLayout