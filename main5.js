// TMDb API 설정
const apiKey = 'ec35f4ad38b521a928052d5a9f4e3655';

document.addEventListener('DOMContentLoaded', () => {
  // 검색 및 결과 표시
  const movieSearchInput = document.getElementById('movieSearchInput');
  const searchResults = document.getElementById('searchResults');
  const imageContainer = document.getElementById('imageContainer');
  const errorLog = document.getElementById('errorLog');
  const scatterPlotCanvas = document.getElementById('scatterPlot');

  // TMDb API로 영화 검색
  async function searchMovies(query) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      logError('Failed to search movies:', error);
      return [];
    }
  }
  function generateScatterPlot(images) {
    const context = scatterPlotCanvas.getContext('2d');
    const width = scatterPlotCanvas.width;
    const height = scatterPlotCanvas.height;
  
    // 캔버스 초기화
    context.clearRect(0, 0, width, height);
  
    // 좌표 변환 함수
    const mapHueToX = (hue) => (hue / 360) * width;
    const mapValueToY = (value) => height - (value / 100) * height;
  
    // 각 이미지를 점으로 시각화
    images.forEach(img => {
      const { h, v } = img.color.hsv; // Hue와 Value 추출
      const x = mapHueToX(h);
      const y = mapValueToY(v);
  
      context.fillStyle = img.color.hex; // 점의 색상 설정
      context.beginPath();
      context.arc(x, y, 2, 0, Math.PI * 2); // 점 그리기
      context.fill();
    });
  }
  
  // TMDb API로 스틸컷 가져오기 (필터링 포함)
  async function fetchMovieStills(movieId) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${apiKey}`
      );
      const data = await response.json();

      const filteredImages = data.backdrops.filter(img => {
        const filePath = img.file_path.toLowerCase();
        const isPromotional = filePath.includes('poster') || filePath.includes('promo');
        const isTooSmall = img.width < 1280 || img.height < 720;

        return !isPromotional && !isTooSmall;
      });

      return filteredImages.map(img => `https://image.tmdb.org/t/p/w500${img.file_path}`);
    } catch (error) {
      logError('Failed to fetch movie stills:', error);
      return [];
    }
  }

  // 평균 RGB 계산
  function getImageAverageColor(imgElement) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;
    context.drawImage(imgElement, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    let r = 0, g = 0, b = 0;

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    const pixelCount = data.length / 4;
    r = Math.floor(r / pixelCount);
    g = Math.floor(g / pixelCount);
    b = Math.floor(b / pixelCount);

      const hex = rgbToHex(r, g, b); // HEX 코드 생성
  return { r, g, b, hex };
  }
  function kMeansCluster(images, k = 5, iterations = 10) {
    const centers = images.slice(0, k).map(img => img.color.hsv); // 초기 중심값 설정
    let clusters = [];
  
    for (let iter = 0; iter < iterations; iter++) {
      clusters = Array.from({ length: k }, () => []);
  
      // 각 이미지를 가장 가까운 중심으로 할당
      images.forEach(img => {
        let closestCenter = 0;
        let minDistance = Infinity;
  
        centers.forEach((center, index) => {
           // Hue와 Value의 거리 계산
          const hueDist = Math.min(Math.abs(center.h - img.color.hsv.h), 360 - Math.abs(center.h - img.color.hsv.h)) / 360 * 2;
          const valueDist = Math.abs(center.v - img.color.hsv.v) / 100;
          const saturationDist = Math.abs(center.s - img.color.hsv.s) / 100;
          const distance = Math.sqrt(
            (hueDist) ** 2 + 
            (saturationDist) ** 2 + 
            (valueDist) ** 2 
          );
  
          if (distance < minDistance) {
            minDistance = distance;
            closestCenter = index;
          }
        });
  
        clusters[closestCenter].push(img);
      });
  
      // 중심값 업데이트
      clusters.forEach((cluster, index) => {
        if (cluster.length > 0) {
          const avgHue = cluster.reduce((sum, img) => sum + img.color.hsv.h, 0) / cluster.length;
          const avgSat = cluster.reduce((sum, img) => sum + img.color.hsv.s, 0) / cluster.length;
          const avgVal =
          cluster.reduce((sum, img) => sum + img.color.hsv.v, 0) /
          cluster.length;
          //const avgSat = cluster.reduce((sum, img) => sum + img.color.hsv.s, 0) / cluster.length;
          centers[index] = { h: avgHue, s: avgSat, v: avgVal }; // 평균값으로 중심 갱신
        }
      });
    }
  
    return { centers, clusters };
  }
  
  function calculateClusterColor(cluster) {
    let totalR = 0, totalG = 0, totalB = 0;
  
    cluster.forEach(img => {
      const { r, g, b } = img.color;
      totalR += r;
      totalG += g;
      totalB += b;
    });
  
    const count = cluster.length;
    const avgR = Math.round(totalR / count);
    const avgG = Math.round(totalG / count);
    const avgB = Math.round(totalB / count);
  
    return `rgb(${avgR}, ${avgG}, ${avgB})`;
  }
  
  // RGB를 HSV로 변환
  function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return { h, s: s * 100, v: v * 100 };
  }
  function resetVisualization() {
    const scatterContext = scatterPlotCanvas.getContext('2d');
    scatterContext.clearRect(0, 0, scatterPlotCanvas.width, scatterPlotCanvas.height);
  
    const histogramContext = hueHistogramCanvas.getContext('2d');
    histogramContext.clearRect(0, 0, hueHistogramCanvas.width, hueHistogramCanvas.height);
  }

  function displayGroups(clusters) {
    imageContainer.innerHTML = ''; // 기존 내용을 초기화
  
    const groupWrapper = document.createElement('div');
    groupWrapper.classList.add('group-wrapper'); // 가로 정렬 부모 컨테이너
  
    clusters.forEach((cluster, index) => {
      const groupContainer = document.createElement('div');
      groupContainer.classList.add('group-container');
  
      // 클러스터 배경색 계산
      const clusterColor = calculateClusterColor(cluster);
      groupContainer.style.backgroundColor = clusterColor; // 배경색 설정
  
      const slideContainer = document.createElement('div');
      slideContainer.classList.add('slide-container');
  
      cluster.forEach(img => {
        const item = document.createElement('div');
        item.classList.add('image-item');
        item.style.backgroundColor = img.color.hex; // 이미지 배경색 설정
        item.innerHTML = `
          <img src="${img.url}" alt="${img.color.hex}" />
          <p>${img.color.hex}</p>
        `;
        slideContainer.appendChild(item);
      });
  
      groupContainer.appendChild(slideContainer);
      groupWrapper.appendChild(groupContainer); // 그룹 추가
    });
  
    imageContainer.appendChild(groupWrapper); // 최종 컨테이너 추가
  }
  
  
  // 영화 선택 및 그룹화
  window.selectMovie = async function selectMovie(movieId, title) {
    const stills = await fetchMovieStills(movieId);
    imageContainer.innerHTML = ''; // 기존 이미지 초기화
  
    if (!stills || stills.length === 0) {
      imageContainer.innerHTML = `<p>No stills found for "${title}".</p>`;
      return;
    }
  
    const coloredImages = await Promise.all(
      stills.map(async (url) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
  
        return new Promise((resolve) => {
          img.onload = () => {
            const color = getImageAverageColor(img);
            color.hsv = rgbToHsv(color.r, color.g, color.b);
            resolve({ url, color });
          };
  
          img.onerror = () => {
            resolve(null); // 로드 실패 시 null 반환
          };
        });
      })
    );
  
    const validImages = coloredImages.filter(img => img !== null);
    if (validImages.length === 0) {
      imageContainer.innerHTML = `<p>All images failed to load for "${title}".</p>`;
      return;
    }
  
    // 그룹화 적용
    const { clusters } = kMeansCluster(validImages, 5); // 5개의 클러스터로 그룹화
    console.log('Clusters:', clusters);
  
    // 그룹별 UI 표시
    displayGroups(clusters); // 외부 함수 호출
  
    // 시각화 생성
    generateScatterPlot(validImages);
  };
  
  document.addEventListener('click', (event) => {
    const clickedCard = event.target.closest('.card'); // 클릭된 카드 확인
    if (!clickedCard) return;
  
    // 기존 선택된 카드에서 'selected' 클래스 제거
    document.querySelectorAll('.search-results .card.selected').forEach(card => {
      card.classList.remove('selected');
    });
  
    // 클릭된 카드에 'selected' 클래스 추가
    clickedCard.classList.add('selected');
  });
  

  // 검색 결과 표시
  async function handleSearch() {
    const query = movieSearchInput.value.trim();
    if (!query) {
      logError('Search input is empty.');
      return;
    }
  
    const movies = await searchMovies(query);
    if (movies.length === 0) {
      searchResults.innerHTML = '<p>No movies found.</p>';
      return;
    }
  
    // 검색 결과를 카드 형식으로 표시
    searchResults.innerHTML = movies
      .map(movie => `
        <div class="card" onclick="selectMovie(${movie.id}, '${movie.title}')">
          <h3>${movie.title}</h3>
          <p>${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
        </div>
      `)
      .join('');
  }
  

  // 에러 로그 표시
  function logError(message, error) {
    console.error(message, error);
    errorLog.innerHTML += `<p>${message} ${error?.message || ''}</p>`;
  }

  document.getElementById('searchButton').addEventListener('click', handleSearch);
});

function rgbToHex(r, g, b) {
  const toHex = (value) => value.toString(16).padStart(2, '0'); // 16진수 변환
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
