  /* eslint-disable react/prop-types */

import Header from "../components/Header"

const AppLayout = ({ children }) => {
  return (
    <div className='min-h-screen bg-gradient-to-bl from-background to-muted'>
      <Header />
      <main className="container mx-auto">
        {children}
      </main>
    </div>
  )
}

export default AppLayout