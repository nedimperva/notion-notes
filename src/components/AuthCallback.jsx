import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notionOAuth } from '../services/notion-oauth'

export default function AuthCallback() {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const hasAttemptedExchange = useRef(false)

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent multiple exchange attempts
      if (hasAttemptedExchange.current) {
        return
      }
      hasAttemptedExchange.current = true

      try {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')
        
        if (error) {
          throw new Error(`Notion authorization error: ${error}`)
        }
        
        if (!code) {
          throw new Error('No authorization code received')
        }

        // Check if we already have auth data
        const existingAuth = notionOAuth.getNotionAuth()
        if (existingAuth) {
          console.log('Already authenticated, redirecting...')
          navigate('/')
          return
        }

        console.log('Exchanging code for token...')
        const tokenData = await notionOAuth.exchangeCodeForToken(code)
        console.log('Token received:', tokenData)

        // Redirect back to the main app
        navigate('/')
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err.message)
        // Clear any existing auth data on error
        notionOAuth.clearNotionAuth()
      } finally {
        setLoading(false)
      }
    }

    handleCallback()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Completing authentication...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900">Authentication Failed</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Return to App
          </button>
        </div>
      </div>
    )
  }

  return null
} 