import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function SmokeComponent() {
  return <h1>SPHEREx Explorer</h1>
}

describe('SPHEREx frontend environment', () => {
  it('renders a React component successfully', () => {
    render(<SmokeComponent />)

    expect(
      screen.getByRole('heading', { name: 'SPHEREx Explorer' })
    ).toBeInTheDocument()
  })
})
