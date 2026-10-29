import { useEffect, useRef } from 'react'
import { MotionConfig } from 'motion/react'
import Nav from '@/components/Nav'
import Teste from '@/pages/Teste'
import Explorar from '@/pages/Explorar'
import Decisao from '@/pages/Decisao'
import { useRota } from '@/lib/rota'

export default function App() {
  const rota = useRota()
  const primeira = useRef(true)
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return }
    window.scrollTo(0, 0)
  }, [rota.pagina])
  return (
    <MotionConfig reducedMotion="user">
      <Nav rota={rota} />
      <main>{rota.pagina === 'mapa' ? <Explorar arg={rota.arg} /> : rota.pagina === 'decisao' ? <Decisao /> : <Teste />}</main>
    </MotionConfig>
  )
}
