#!/usr/bin/env python3
"""
PLTR Stock Chart with Candlesticks and Simple Moving Averages
- Candlestick chart
- 5-day SMA (short-term)
- 20-day SMA (medium-term)
- 60-day SMA (long-term)
"""

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta
import numpy as np

# Try to import requests for live data
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


def fetch_live_stock_data(ticker: str, period_days: int = 240) -> pd.DataFrame:
    """Fetch historical stock data from Yahoo Finance API."""
    if not REQUESTS_AVAILABLE:
        return pd.DataFrame()

    end_date = datetime.now()
    start_date = end_date - timedelta(days=period_days)

    # Convert to Unix timestamps
    period1 = int(start_date.timestamp())
    period2 = int(end_date.timestamp())

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    params = {
        'period1': period1,
        'period2': period2,
        'interval': '1d',
        'events': 'history'
    }

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)

        if response.status_code != 200:
            return pd.DataFrame()

        data = response.json()

        # Parse the response
        chart = data['chart']['result'][0]
        timestamps = chart['timestamp']
        quote = chart['indicators']['quote'][0]

        df = pd.DataFrame({
            'Date': pd.to_datetime(timestamps, unit='s'),
            'Open': quote['open'],
            'High': quote['high'],
            'Low': quote['low'],
            'Close': quote['close'],
            'Volume': quote['volume']
        })

        df.set_index('Date', inplace=True)
        df = df.dropna()

        return df

    except Exception as e:
        print(f"Could not fetch live data: {e}")
        return pd.DataFrame()


def generate_sample_data(ticker: str = 'PLTR', days: int = 180) -> pd.DataFrame:
    """Generate realistic sample stock data for demonstration."""
    np.random.seed(42)  # For reproducibility

    # Start from a base price around PLTR's historical range
    base_price = 25.0
    dates = pd.date_range(end=datetime.now(), periods=days, freq='B')  # Business days

    # Generate price movements with some trend and volatility
    returns = np.random.normal(0.002, 0.03, days)  # Slight upward bias, 3% daily vol
    prices = base_price * np.cumprod(1 + returns)

    # Generate OHLC data
    data = []
    for i, (date, close) in enumerate(zip(dates, prices)):
        daily_range = close * np.random.uniform(0.01, 0.04)
        high = close + np.random.uniform(0, daily_range)
        low = close - np.random.uniform(0, daily_range)
        open_price = low + np.random.uniform(0, high - low)

        # Ensure OHLC consistency
        high = max(open_price, close, high)
        low = min(open_price, close, low)

        volume = int(np.random.uniform(30_000_000, 80_000_000))

        data.append({
            'Date': date,
            'Open': round(open_price, 2),
            'High': round(high, 2),
            'Low': round(low, 2),
            'Close': round(close, 2),
            'Volume': volume
        })

    df = pd.DataFrame(data)
    df.set_index('Date', inplace=True)

    return df


def calculate_sma(df: pd.DataFrame, windows: list) -> pd.DataFrame:
    """Calculate Simple Moving Averages for given windows."""
    for window in windows:
        df[f'SMA_{window}'] = df['Close'].rolling(window=window).mean()
    return df


def plot_candlestick_chart(df: pd.DataFrame, ticker: str, is_sample: bool = False):
    """Plot candlestick chart with SMA lines using Plotly."""

    # Create subplots with shared x-axis
    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.03,
        subplot_titles=(f'{ticker} Stock Price', 'Volume'),
        row_heights=[0.7, 0.3]
    )

    # Add candlestick chart
    fig.add_trace(
        go.Candlestick(
            x=df.index,
            open=df['Open'],
            high=df['High'],
            low=df['Low'],
            close=df['Close'],
            name='OHLC',
            increasing_line_color='green',
            decreasing_line_color='red'
        ),
        row=1, col=1
    )

    # Add SMA lines
    fig.add_trace(
        go.Scatter(
            x=df.index,
            y=df['SMA_5'],
            mode='lines',
            name='SMA 5',
            line=dict(color='blue', width=1.5)
        ),
        row=1, col=1
    )

    fig.add_trace(
        go.Scatter(
            x=df.index,
            y=df['SMA_20'],
            mode='lines',
            name='SMA 20',
            line=dict(color='orange', width=1.5)
        ),
        row=1, col=1
    )

    fig.add_trace(
        go.Scatter(
            x=df.index,
            y=df['SMA_60'],
            mode='lines',
            name='SMA 60',
            line=dict(color='purple', width=1.5)
        ),
        row=1, col=1
    )

    # Add volume bars
    colors = ['green' if close >= open_p else 'red'
              for close, open_p in zip(df['Close'], df['Open'])]

    fig.add_trace(
        go.Bar(
            x=df.index,
            y=df['Volume'],
            name='Volume',
            marker_color=colors,
            opacity=0.7
        ),
        row=2, col=1
    )

    # Update layout
    title_suffix = " (Sample Data)" if is_sample else ""
    fig.update_layout(
        title=dict(
            text=f'{ticker} Stock Chart with Moving Averages (5, 20, 60 days){title_suffix}',
            x=0.5,
            font=dict(size=18)
        ),
        xaxis_rangeslider_visible=False,
        height=800,
        width=1400,
        showlegend=True,
        legend=dict(
            yanchor="top",
            y=0.99,
            xanchor="left",
            x=0.01
        ),
        template='plotly_white'
    )

    # Update y-axis labels
    fig.update_yaxes(title_text="Price (USD)", row=1, col=1)
    fig.update_yaxes(title_text="Volume", row=2, col=1)

    # Save as HTML (interactive)
    html_file = f'{ticker.lower()}_stock_chart.html'
    fig.write_html(html_file)
    print(f"Interactive chart saved to: {html_file}")

    # Save as PNG (static image)
    try:
        png_file = f'{ticker.lower()}_stock_chart.png'
        fig.write_image(png_file, scale=2)
        print(f"Static chart saved to: {png_file}")
    except Exception as e:
        print(f"Note: Could not save PNG (requires kaleido package): {e}")

    return fig


def main():
    ticker = 'PLTR'
    print(f"Fetching stock data for {ticker}...")

    # Try to fetch live data first
    df = fetch_live_stock_data(ticker, period_days=240)
    is_sample = False

    if df.empty:
        print("Using sample data for demonstration...")
        df = generate_sample_data(ticker, days=180)
        is_sample = True

    print(f"Loaded {len(df)} days of data")
    print(f"Date range: {df.index[0].strftime('%Y-%m-%d')} to {df.index[-1].strftime('%Y-%m-%d')}")

    # Calculate SMAs
    df = calculate_sma(df, windows=[5, 20, 60])

    # For plotting, use all data (SMAs will be NaN at the beginning)
    df_plot = df.copy()

    print(f"\nLatest data ({df.index[-1].strftime('%Y-%m-%d')}):")
    print(f"  Open:   ${df['Open'].iloc[-1]:.2f}")
    print(f"  High:   ${df['High'].iloc[-1]:.2f}")
    print(f"  Low:    ${df['Low'].iloc[-1]:.2f}")
    print(f"  Close:  ${df['Close'].iloc[-1]:.2f}")
    print(f"  SMA 5:  ${df['SMA_5'].iloc[-1]:.2f}")
    print(f"  SMA 20: ${df['SMA_20'].iloc[-1]:.2f}")
    print(f"  SMA 60: ${df['SMA_60'].iloc[-1]:.2f}")

    # Plot the chart
    print("\nGenerating chart...")
    plot_candlestick_chart(df_plot, ticker, is_sample)

    print("\nDone! Open the HTML file in a browser for an interactive chart.")


if __name__ == '__main__':
    main()
