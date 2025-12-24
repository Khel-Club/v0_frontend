'use client';

import React, { useEffect, useState } from 'react';
import styles from './Fixtures.module.scss';
import { endpoints } from '@/store/urls';
import { apiCall } from '@/store/utils';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import KnockoutBracket from './KnockoutBracket';


const Fixtures = ({ 
    matches: externalMatches, 
    tournamentId,
    onMatchClick, 
    showCourtInfo = false, 
    selectedPool, 
    onPoolChange,
    selectedRound,
    onRoundChange,
    referee = false,
    courtManagement = false,
    refreshKey = 0,
    matchFilter = () => true,
    groupByCourt = false,
    showOnlyFilters = false,
    hideFilters = false
}) => {
    const router = useRouter();
    const [matches, setMatches] = useState(externalMatches || {});
    const [loading, setLoading] = useState(false);
    const [internalSelectedRound, setInternalSelectedRound] = useState(null);
    const [internalSelectedPoolId, setInternalSelectedPoolId] = useState(null);
    const [selectedCourt, setSelectedCourt] = useState(null);
    const [showCourtModal, setShowCourtModal] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [availableCourts, setAvailableCourts] = useState([]);
    const [knockoutMatches, setKnockoutMatches] = useState([]);
    const [showKnockouts, setShowKnockouts] = useState(false);

    // Use controlled or uncontrolled round selection
    const effectiveSelectedRound = selectedRound ?? internalSelectedRound;
    const effectiveSelectedPool = selectedPool ?? internalSelectedPoolId;

    useEffect(() => {
        if (externalMatches) {
            setMatches(externalMatches);
            return;
        }
        
        if (tournamentId) {
            fetchMatches();
        }
    }, [tournamentId, externalMatches, refreshKey]);

    useEffect(() => {
        if (matches && Object.keys(matches).length > 0) {
            const rounds = Object.keys(matches).sort((a, b) => Number(a) - Number(b));
            const lastRound = rounds[rounds.length - 1];
            if (!effectiveSelectedRound) {
                handleRoundClick(lastRound);
            }
        }
    }, [matches]);

    const parseMatchResult = (result) => {
        if (!result) return { team1Score: 0, team2Score: 0 };
        
        const scores = result.split('-').map(Number);
        return {
            team1Score: scores[0] || 0,
            team2Score: scores[1] || 0
        };
    };

    const fetchMatches = async () => {
        try {
            setLoading(true);
            const url = `${endpoints.getFixtures}?tournament_id=${tournamentId}`;
            console.log('Fetching matches from:', url);
            const response = await apiCall(url);
            
            if (response && response.matches) {
                // Transform the matches data
                const transformedData = {};
                const knockoutMatchesArray = [];

                response.matches.forEach(match => {
                    // If match has bracket_info, it's a knockout match
                    if (match.bracket_info) {
                        knockoutMatchesArray.push({
                            ...match,
                            ...parseMatchResult(match.match_result),
                            status: match.match_status?.status || 'pending',
                            winner_team_id: match.match_status?.is_final ? match.match_status?.winner_team_id : null,
                        });
                        return;
                    }

                    const roundId = match.round_id || 'unassigned';
                    if (!transformedData[roundId]) {
                        transformedData[roundId] = {
                            round_name: match.round_name || `Round ${match.round_id}`,
                            pools: {}
                        };
                    }
                    
                    const poolId = match.pool || 'unassigned';
                    if (!transformedData[roundId].pools[poolId]) {
                        transformedData[roundId].pools[poolId] = [];
                    }

                    transformedData[roundId].pools[poolId].push({
                        ...match,
                        round_name: match.round_name || `Round ${match.round_id}`,
                        ...parseMatchResult(match.match_result),
                        status: match.match_status?.status || 'pending',
                        winner_team_id: match.match_status?.is_final ? match.match_status?.winner_team_id : null,
                        team1_id: match.team1?.team_id,
                        team2_id: match.team2?.team_id,
                        team1_checked_in: match.team1?.checked_in,
                        team2_checked_in: match.team2?.checked_in
                    });
                });
                
                setMatches(transformedData);
                setKnockoutMatches(knockoutMatchesArray);
            }
        } catch (error) {
            console.error('Error fetching matches:', error);
            toast.error('Failed to fetch matches');
        } finally {
            setLoading(false);
        }
    };

    const getAvailableCourts = () => {
        const courts = new Set();
        Object.values(matches).forEach(round => {
            Object.values(round.pools).forEach(pool => {
                pool.forEach(match => {
                    if (match.court_number) {
                        courts.add(match.court_number);
                    }
                });
            });
        });
        const availableCourts = Array.from(courts).sort((a, b) => a - b);
        console.log('Available courts:', availableCourts);
        return availableCourts;
    };

    const getFilteredMatches = () => {
        if (!matches || !effectiveSelectedRound) return [];
        
        const roundData = matches[effectiveSelectedRound];
        if (!roundData?.pools) return [];

        const allMatches = [];
        Object.entries(roundData.pools).forEach(([poolId, poolMatches]) => {
            if (!effectiveSelectedPool || effectiveSelectedPool === poolId) {
                poolMatches.forEach(match => {
                    if (matchFilter(match)) {
                        allMatches.push({
                            ...match,
                            round_name: roundData.round_name,
                            poolId
                        });
                    }
                });
            }
        });

        if (groupByCourt) {
            const groupedMatches = {};
            allMatches.forEach(match => {
                const courtNumber = match.court_number || 'unassigned';
                if (!groupedMatches[courtNumber]) {
                    groupedMatches[courtNumber] = [];
                }
                groupedMatches[courtNumber].push(match);
            });
            return groupedMatches;
        }

        return allMatches;
    };

    const getMatchesGroupedByCourt = () => {
        const matches = getFilteredMatches();
        const groupedMatches = {};
        
        matches.forEach(match => {
            if (match.court_number) {
                if (!groupedMatches[match.court_number]) {
                    groupedMatches[match.court_number] = [];
                }
                groupedMatches[match.court_number].push(match);
            }
        });

        // Sort courts numerically
        return Object.keys(groupedMatches)
            .sort((a, b) => Number(a) - Number(b))
            .reduce((acc, court) => {
                acc[court] = groupedMatches[court];
                return acc;
            }, {});
    };

    const handleRoundClick = (roundId) => {
        if (onRoundChange) {
            onRoundChange(roundId);
        } else {
            setInternalSelectedRound(roundId);
        }
        // Reset pool selection when changing rounds
        handlePoolClick(null);
    };

    const handlePoolClick = (poolId) => {
        if (onPoolChange) {
            onPoolChange(poolId);
        } else {
            setInternalSelectedPoolId(poolId);
        }
    };

    const handleMatchClick = (match) => {
        console.log('Fixtures handleMatchClick called', match);
        if (courtManagement && (!match.team1_checked_in || !match.team2_checked_in)) {
            toast.error('All players must be checked in before assigning a court');
            return;
        }
        if (referee) {
            router.push(`/referee/${tournamentId}/matches/${match.match_id}`);
        } else if (courtManagement) {
            onMatchClick?.(match);
        } else {
            onMatchClick?.(match);
        }
    };

    const fetchAvailableCourts = async () => {
        try {
            const response = await apiCall(endpoints.getTournamentDetails + `/${tournamentId}`);
            if (response?.number_of_courts) {
                const courts = Array.from({ length: response.number_of_courts }, (_, i) => i + 1);
                setAvailableCourts(courts);
            }
        } catch (error) {
            console.error('Failed to fetch courts:', error);
            toast.error('Failed to fetch available courts');
        }
    };

    const handleCourtAssignment = async () => {
        if (!selectedMatch || !selectedCourt) return;

        try {
            setLoading(true);
            const response = await apiCall(endpoints.assignCourt, {
                method: 'POST',
                data: {
                    match_id: selectedMatch.match_id,
                    court_number: selectedCourt
                }
            });

            if (response.success) {
                toast.success('Court assigned successfully');
                // Refresh matches to show updated court assignment
                fetchMatches();
            }
        } catch (error) {
            toast.error('Failed to assign court');
            console.error('Court assignment error:', error);
        } finally {
            setLoading(false);
            setShowCourtModal(false);
            setSelectedMatch(null);
            setSelectedCourt(null);
        }
    };

    const handleCourtClick = (courtNumber) => {
        setSelectedCourt(courtNumber === selectedCourt ? null : courtNumber);
    };

    const renderMatches = (matches, isAssigned = false) => {
        return matches
            .map((match) => (
                <div
                    key={match.match_id}
                    className={`${styles.matchCard} ${
                        !courtManagement && match.status === 'completed' ? styles.completed : ''
                    } ${!courtManagement && referee ? styles.refereeMode : ''}`}
                    onClick={() => handleMatchClick(match)}
                >
                    {match.outcome === 'walkover' && (
                        <div className={styles.walkoverRibbon}>Walkover</div>
                    )}
                    <div className={styles.matchId}>
                        Match ID: {match.match_id}
                    </div>
                    <div className={styles.teams}>
                        <div className={`${styles.team} ${
                            match.team1_checked_in === true ? styles.checkedIn : ''
                        }`}>
                            <div className={styles.teamPlayers}>
                                {match.team1_players}
                                {match.outcome === 'walkover' && match.winner_team_id === match.team1_id && (
                                    <span className={styles.walkoverBadge}>Walkover Win</span>
                                )}
                            </div>
                            {match.team1_id && (
                                <div className={styles.teamId}>Team ID: {match.team1_id}</div>
                            )}
                            <div className={styles.score}>{match.team1Score}</div>
                        </div>
                        <div className={styles.vs}>vs</div>
                        <div className={`${styles.team} ${
                            match.team2_checked_in === true ? styles.checkedIn : ''
                        }`}>
                            <div className={styles.teamPlayers}>
                                {match.team2_players}
                                {match.outcome === 'walkover' && match.winner_team_id === match.team2_id && (
                                    <span className={styles.walkoverBadge}>Walkover Win</span>
                                )}
                            </div>
                            {match.team2_id && (
                                <div className={styles.teamId}>Team ID: {match.team2_id}</div>
                            )}
                            <div className={styles.score}>{match.team2Score}</div>
                        </div>
                    </div>
                    <div className={styles.matchInfo}>
                        <span className={styles.pool}>Pool: {match.pool}</span>
                        <span className={styles.round}>{match.round_name}</span>
                        {match.court_number && <span className={styles.courtAssigned}>Court: {match.court_number}</span>}
                    </div>
                </div>
            ));
    };

    const renderGroupedMatches = (groupedMatches) => {
        return Object.entries(groupedMatches)
            .sort(([courtA], [courtB]) => {
                if (courtA === 'unassigned') return 1;
                if (courtB === 'unassigned') return -1;
                return Number(courtA) - Number(courtB);
            })
            .map(([courtNumber, matches]) => (
                <div key={courtNumber} className={styles.courtGroup}>
                    <h3 className={styles.courtHeader}>
                        {courtNumber === 'unassigned' ? 'Unassigned' : `Court ${courtNumber}`}
                    </h3>
                    <div className={styles.courtMatches}>
                        {matches.map((match) => (
                            <div
                                key={match.match_id}
                                className={`${styles.matchCard} ${
                                    !courtManagement && match.status === 'completed' ? styles.completed : ''
                                } ${!courtManagement && referee ? styles.refereeMode : ''}`}
                                onClick={() => handleMatchClick(match)}
                            >
                                <div className={styles.matchInfo}>
                                    <div className={styles.matchId}>
                                        Match ID: {match.match_id}
                                    </div>
                                    {match.round_name && (
                                        <div className={styles.roundName}>
                                            {match.round_name}
                                        </div>
                                    )}
                                </div>
                                <div className={styles.teams}>
                                    <div className={`${styles.team} ${
                                        match.team1_checked_in ? styles.checkedIn : ''
                                    }`}>
                                            <div className={styles.teamPlayers}>
                                                {match.team1_players}
                                                {match.outcome === 'walkover' && match.winner_team_id === match.team1_id && (
                                                    <span className={styles.walkoverBadge}>Walkover Win</span>
                                                )}
                                            </div>
                                        {match.team1_id && (
                                            <div className={styles.teamId}>Team ID: {match.team1_id}</div>
                                        )}
                                        <div className={styles.score}>{match.team1Score}</div>
                                    </div>
                                    <div className={styles.vs}>vs</div>
                                    <div className={`${styles.team} ${
                                        match.team2_checked_in ? styles.checkedIn : ''
                                    }`}>
                                            <div className={styles.teamPlayers}>
                                                {match.team2_players}
                                                {match.outcome === 'walkover' && match.winner_team_id === match.team2_id && (
                                                    <span className={styles.walkoverBadge}>Walkover Win</span>
                                                )}
                                            </div>
                                        {match.team2_id && (
                                            <div className={styles.teamId}>Team ID: {match.team2_id}</div>
                                        )}
                                        <div className={styles.score}>{match.team2Score}</div>
                                    </div>
                                </div>
                                {match.status === 'completed' && (
                                    <div className={styles.status}>Completed</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ));
    };

    const filteredMatches = getFilteredMatches();

    if (showOnlyFilters) {
        return (
            <div className={styles.filtersOnly}>
                {/* Round Tabs */}
                <div className={styles.roundTabs}>
                    <button
                        className={`${styles.roundTab} ${!showKnockouts ? styles.active : ''}`}
                        onClick={() => setShowKnockouts(false)}
                    >
                        Rounds
                    </button>
                    <button
                        className={`${styles.roundTab} ${showKnockouts ? styles.active : ''}`}
                        onClick={() => setShowKnockouts(true)}
                    >
                        Knockouts
                    </button>
                </div>

                {!showKnockouts && (
                    <>
                        {Object.entries(matches)
                            .sort(([a], [b]) => Number(b) - Number(a))
                            .map(([roundId, roundData]) => (
                                <button
                                    key={roundId}
                                    className={`${styles.roundTab} ${effectiveSelectedRound === roundId ? styles.active : ''}`}
                                    onClick={() => handleRoundClick(roundId)}
                                >
                                    {roundData.round_name}
                                </button>
                            ))}

                        {/* Pool Tabs */}
                        {effectiveSelectedRound && matches[effectiveSelectedRound]?.pools && (
                            <div className={styles.poolTabs}>
                                {Object.keys(matches[effectiveSelectedRound].pools)
                                    .filter(poolId => poolId !== 'unassigned')
                                    .sort()
                                    .map((poolId) => (
                                        <button
                                            key={poolId}
                                            className={`${styles.poolTab} ${effectiveSelectedPool === poolId ? styles.active : ''}`}
                                            onClick={() => handlePoolClick(poolId)}
                                        >
                                            {poolId}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    return (
        <div className={styles.fixturesContainer}>
            {loading ? (
                <div className={styles.loading}>Loading matches...</div>
            ) : (
                <>
                    {!hideFilters && (
                        <div className={styles.roundTabs}>
                            <button
                                className={`${styles.roundTab} ${!showKnockouts ? styles.active : ''}`}
                                onClick={() => setShowKnockouts(false)}
                            >
                                Rounds
                            </button>
                            <button
                                className={`${styles.roundTab} ${showKnockouts ? styles.active : ''}`}
                                onClick={() => setShowKnockouts(true)}
                            >
                                Knockouts
                            </button>
                        </div>
                    )}

                    {!showKnockouts ? (
                        <>
                            {!hideFilters && (
                                <>
                                    {/* Round Tabs */}
                                    <div className={styles.roundTabs}>
                                        {Object.entries(matches)
                                            .sort(([a], [b]) => Number(b) - Number(a))
                                            .map(([roundId, roundData]) => (
                                                <button
                                                    key={roundId}
                                                    className={`${styles.roundTab} ${effectiveSelectedRound === roundId ? styles.active : ''}`}
                                                    onClick={() => handleRoundClick(roundId)}
                                                >
                                                    {roundData.round_name}
                                                </button>
                                            ))}
                                    </div>

                                    {/* Pool Tabs */}
                                    {effectiveSelectedRound && matches[effectiveSelectedRound]?.pools && (
                                        <div className={styles.poolTabs}>
                                            {Object.keys(matches[effectiveSelectedRound].pools)
                                                .filter(poolId => poolId !== 'unassigned')
                                                .sort()
                                                .map((poolId) => (
                                                    <button
                                                        key={poolId}
                                                        className={`${styles.poolTab} ${effectiveSelectedPool === poolId ? styles.active : ''}`}
                                                        onClick={() => handlePoolClick(poolId)}
                                                    >
                                                        {poolId}
                                                    </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            <div className={styles.matchesContainer}>
                                {groupByCourt 
                                    ? renderGroupedMatches(filteredMatches)
                                    : renderMatches(filteredMatches)}
                            </div>
                        </>
                    ) : (
                        <div className={styles.knockoutContainer}>
                            <KnockoutBracket 
                                matches={knockoutMatches} 
                                onMatchClick={handleMatchClick} 
                            />
                        </div>
                    )}
                </>
            )}

            {showCourtModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>Assign Court</h3>
                        <div className={styles.matchInfo}>
                            <p>Match ID: {selectedMatch?.match_id}</p>
                            <p>Teams: {selectedMatch?.team1_players} vs {selectedMatch?.team2_players}</p>
                            <p>Pool: {selectedMatch?.pool}</p>
                            <p>Round: {selectedMatch?.round_name}</p>
                        </div>

                        {/* TODO: modularize this */}
                        <select
                            value={selectedCourt || ''}
                            onChange={(e) => setSelectedCourt(Number(e.target.value))}
                            className={styles.courtSelect}
                        >
                            <option value="">Select Court</option>
                            {availableCourts.map(court => (
                                <option key={court} value={court}>
                                    Court {court}
                                </option>
                            ))}

                        </select>


                        <div className={styles.modalActions}>
                            <button
                                onClick={handleCourtAssignment}
                                disabled={loading || !selectedCourt}
                                className={styles.assignButton}
                            >
                                {loading ? 'Assigning...' : 'Assign Court'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCourtModal(false);
                                    setSelectedMatch(null);
                                    setSelectedCourt(null);
                                }}
                                className={styles.cancelButton}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Fixtures;
