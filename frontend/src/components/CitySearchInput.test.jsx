import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CitySearchInput from './CitySearchInput'

function ControlledCityInput() {
  const [value, setValue] = useState('')
  return (
    <CitySearchInput
      id="destination"
      label="Destination"
      value={value}
      onChange={setValue}
      placeholder="e.g. Berlin, Germany"
    />
  )
}

function getInput() {
  return screen.getByLabelText('Destination')
}

test('typing filters the dropdown to matching supported cities only', () => {
  render(<ControlledCityInput />)

  fireEvent.change(getInput(), { target: { value: 'ber' } })

  expect(screen.getByText('Berlin, Germany')).toBeInTheDocument()
  expect(screen.queryByText('Oslo, Norway')).not.toBeInTheDocument()
})

test('the filter is case-insensitive', () => {
  render(<ControlledCityInput />)

  fireEvent.change(getInput(), { target: { value: 'OSLO' } })

  expect(screen.getByText('Oslo, Norway')).toBeInTheDocument()
})

test('clicking a result fills the input with "City, Country" and closes the dropdown', () => {
  render(<ControlledCityInput />)

  fireEvent.change(getInput(), { target: { value: 'oslo' } })
  fireEvent.click(screen.getByText('Oslo, Norway'))

  expect(getInput()).toHaveValue('Oslo, Norway')
  expect(screen.queryByText('Oslo, Norway', { selector: 'button' })).not.toBeInTheDocument()
})

test('a query matching no supported city shows no dropdown, but still allows the typed text', () => {
  render(<ControlledCityInput />)

  fireEvent.change(getInput(), { target: { value: 'Nowhereville' } })

  expect(getInput()).toHaveValue('Nowhereville')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('Escape closes the dropdown without clearing the typed value', () => {
  render(<ControlledCityInput />)

  fireEvent.change(getInput(), { target: { value: 'par' } })
  expect(screen.getByText('Paris, France')).toBeInTheDocument()

  fireEvent.keyDown(getInput(), { key: 'Escape' })

  expect(screen.queryByText('Paris, France')).not.toBeInTheDocument()
  expect(getInput()).toHaveValue('par')
})

test('focusing an already-filled input reopens the dropdown', () => {
  render(<ControlledCityInput />)

  fireEvent.change(getInput(), { target: { value: 'rome' } })
  fireEvent.keyDown(getInput(), { key: 'Escape' })
  expect(screen.queryByText('Rome, Italy')).not.toBeInTheDocument()

  fireEvent.focus(getInput())

  expect(screen.getByText('Rome, Italy')).toBeInTheDocument()
})

test('focusing an empty input does not open the dropdown (avoids burying whatever sits below an autoFocus field on page load)', () => {
  render(<ControlledCityInput />)

  fireEvent.focus(getInput())

  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('typing a single broad character shows matches capped at 8', () => {
  render(<ControlledCityInput />)

  fireEvent.change(getInput(), { target: { value: 'a' } })

  expect(screen.getAllByRole('button')).toHaveLength(8)
})

test('marks the field required, including on the native input', () => {
  render(
    <CitySearchInput id="origin" label="Departure" value="" onChange={() => {}} required />
  )

  expect(screen.getByText('*')).toBeInTheDocument()
  expect(screen.getByLabelText(/Departure/)).toBeRequired()
})
