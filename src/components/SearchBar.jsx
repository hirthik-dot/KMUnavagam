import './SearchBar.css';

function SearchBar({ searchQuery, setSearchQuery }) {
    return (
        <div className="search-bar">
            <div className="search-icon">Search</div>
            <input
                type="text"
                className="search-input"
                placeholder="Search food items... (press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
                <button
                    className="clear-search-btn"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                >
                    ✕
                </button>
            )}
        </div>
    );
}

export default SearchBar;
