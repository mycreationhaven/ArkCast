const VIDEO_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/

export class PeerTubeClient {
  constructor({ baseUrl, accessToken, fetchImpl = fetch }) {
    const url = new URL(baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('PeerTube URL must use HTTP or HTTPS')
    if (url.username || url.password || url.search || url.hash) throw new TypeError('PeerTube URL must not include credentials, query, or fragment')
    this.baseUrl = url.toString().replace(/\/$/, '')
    this.accessToken = accessToken || null
    this.fetchImpl = fetchImpl
  }

  async request(path) {
    const headers = { accept: 'application/json' }
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`
    const response = await this.fetchImpl(new URL(path, `${this.baseUrl}/`), { headers })
    if (!response.ok) throw new Error(`PeerTube request failed with HTTP ${response.status}`)
    return response.json()
  }

  getVideo(videoId) {
    if (!VIDEO_ID.test(videoId)) throw new TypeError('Invalid PeerTube video ID')
    return this.request(`/api/v1/videos/${encodeURIComponent(videoId)}`)
  }

  getCaptions(videoId) {
    if (!VIDEO_ID.test(videoId)) throw new TypeError('Invalid PeerTube video ID')
    return this.request(`/api/v1/videos/${encodeURIComponent(videoId)}/captions`)
  }
}
