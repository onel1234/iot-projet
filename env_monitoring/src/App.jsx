//import { useState } from 'react'
import './App.css'
import Header from "./components/layout/Header";
import Footer from './components/layout/Footer';
import LivingConditionScore from './components/dashboard/LivingConditionScore';

function App() {
  return (
    <div>
      <Header />
      <LivingConditionScore/>
      <br></br>
      <Footer />
    </div>
  )
}

export default App