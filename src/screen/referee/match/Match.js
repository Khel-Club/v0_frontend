'use client'

import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useRouter } from "next/navigation";
import { endpoints } from "@/store/urls";
import { apiCall } from "@/store/utils";
import stl from "./Match.module.scss";
import toast from "react-hot-toast";
import { TextField } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Dialog, DialogActions, DialogContent, DialogTitle, Button } from "@mui/material";

const MatchScreen = ({ tournamentId, matchId }) => {
    const [scoreData, setScoreData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setModalOpen] = useState(false);
    const [showWalkoverModal, setShowWalkoverModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [matchStatus, setMatchStatus] = useState(null);
    const router = useRouter();

    const getScores = async () => {
        setLoading(true);
        try {
            if (!tournamentId) {
                throw new Error("Tournament ID is missing");
            }

            const response = await apiCall(endpoints.getMatchScore, {
                method: "GET",
                params: {
                    match_id: matchId,
                    tournament_id: tournamentId,
                },
            });
            
            if (!response) {
                throw new Error("Failed to fetch match details");
            }

            setMatchStatus(response.status || 'pending');
            
            if (response.status === 'completed') {
                setShowStatusModal(true);
            } else if (response.status === 'pending') {
                setShowStatusModal(true);
            }

            setScoreData(response);
            if (response.team1?.score !== undefined) {
                formik.setFieldValue("team1Score", response.team1.score);
            }
            if (response.team2?.score !== undefined) {
                formik.setFieldValue("team2Score", response.team2.score);
            }
        } catch (error) {
            console.error("Failed to fetch Score:", error.message);
            toast.error(error.message || "Failed to fetch match details");
            setScoreData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tournamentId && matchId) {
            getScores();
        }
    }, [tournamentId, matchId]);

    const formik = useFormik({
        initialValues: {
            team1Score: 0,
            team2Score: 0,
        },
        validationSchema: Yup.object({
            team1Score: Yup.number().min(0, "Score cannot be negative").required("Required"),
            team2Score: Yup.number().min(0, "Score cannot be negative").required("Required"),
        }),
        onSubmit: (values) => updateScore(),
    });

    const handleScoreChange = (team, scoreChange) => {
        formik.setFieldValue(
            team === "team1" ? "team1Score" : "team2Score",
            Math.max(formik.values[team === "team1" ? "team1Score" : "team2Score"] + scoreChange, 0)
        );
    };

    const resetScore = (team) => {
        formik.setFieldValue(team === "team1" ? "team1Score" : "team2Score", 0);
    };

    const updateScore = async (isFinal = false, override = false) => {
        try {
            const requestBody = {
                tournament_id: tournamentId,
                match_id: matchId,
                score: `${formik.values.team1Score}-${formik.values.team2Score}`,
                final: isFinal,
                override: override
            };

            const scorePromise = fetch(endpoints.updateMatchScore, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody),
            });

            const statusPromise = isFinal ? 
                apiCall(`${endpoints.updateMatchStatus}/${matchId}`, {
                    method: "POST",
                    body: {
                        tournament_id: tournamentId,
                        status: "completed"
                    }
                }) : Promise.resolve();

            const [response, statusResponse] = await Promise.all([
                scorePromise,
                statusPromise
            ]);

            const resp = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    toast.error("Tournament or match not found");
                } else if (response.status === 400) {
                    if (resp.error.includes("already been finalized")) {
                        const shouldOverride = window.confirm("Match is already finalized. Would you like to override?");
                        if (shouldOverride) {
                            return updateScore(isFinal, true);
                        }
                    }
                    toast.error(resp.error);
                } else {
                    toast.error("An error occurred while updating the score");
                }
                throw new Error(`Error ${response.status}: ${resp.error}`);
            }

            if (resp) {
                toast.success(resp.message);
                formik.setFieldValue("team1Score", resp.team1_score);
                formik.setFieldValue("team2Score", resp.team2_score);
                
                if (isFinal && resp.winner_team_id) {
                    setScoreData(prev => ({
                        ...prev,
                        winner_team_id: resp.winner_team_id
                    }));
                    setMatchStatus('completed');
                }
                
                if (isFinal) {
                    router.push(`/referee/${tournamentId}/matches`);
                }
            }
        } catch (error) {
            console.error("Failed to update score:", error);
            toast.error("Failed to update score. Please try again.");
        }
    };

    const finalizeScore = () => {
        setModalOpen(true);
    };

    const confirmFinalize = () => {
        setModalOpen(false);
        updateScore(true);
    };

    const handleStartMatch = async () => {
        try {
            await apiCall(`${endpoints.updateMatchStatus}/${matchId}`, {
                method: "POST",
                body: {
                    tournament_id: tournamentId,
                    status: "on-going"
                }
            });
            
            setMatchStatus('on-going');
            setShowStatusModal(false);
            toast.success("Match started successfully");
        } catch (error) {
            console.error("Failed to start match:", error);
            toast.error(error.message || "Failed to start match");
        }
    };

    const markWalkover = async (winnerTeamId) => {
        setShowWalkoverModal(false);
        try {
            const resp = await apiCall(endpoints.updateMatchOutcome, {
                method: "POST",
                body: {
                    tournament_id: tournamentId,
                    match_id: matchId,
                    outcome: "walkover",
                    winner_team_id: winnerTeamId
                }
            });
            toast.success(resp.message);
            router.push(`/referee/${tournamentId}/matches`);
        } catch (error) {
            toast.error(error.message || "Failed to mark walkover");
        }
    };

    const handleBackToMatches = () => {
        router.push(`/referee/${tournamentId}/matches`);
    };

    if (loading) {
        return <div className={stl.loading}>Loading match details...</div>;
    }

    if (!scoreData) {
        return <div className={stl.error}>No match data available</div>;
    }

    return (
        <div className={stl.container}>
            <div className={stl.header}>
                <button onClick={handleBackToMatches}>
                    <ArrowBackIcon />
                </button>
                <h2>Update Score</h2>
            </div>

            <div className={stl.matchInfo}>
                <div className={stl.infoItem}>
                    <span className={stl.label}>Status:</span>
                    <span className={`${stl.value} ${stl[matchStatus?.replace('-', '_')] || ''}`}>
                        {matchStatus ? matchStatus.charAt(0).toUpperCase() + matchStatus.slice(1) : 'Unknown'}
                    </span>
                </div>
                <div className={stl.infoItem}>
                    <span className={stl.label}>Tournament ID:</span>
                    <span className={stl.value}>{tournamentId}</span>
                </div>
                <div className={stl.infoItem}>
                    <span className={stl.label}>Match ID:</span>
                    <span className={stl.value}>{matchId}</span>
                </div>
            </div>

            <form onSubmit={formik.handleSubmit} className={stl.scoreForm}>
                <div className={stl.teams}>
                    <TeamCard
                        team={scoreData.team1}
                        players={scoreData.team1?.players || []}
                        onScoreChange={(change) => handleScoreChange("team1", change)}
                        onReset={() => resetScore("team1")}
                        formik={formik}
                        teamName="team1Score"
                    />

                    <div className={stl.vs}>VS</div>

                    <TeamCard
                        team={scoreData.team2}
                        players={scoreData.team2?.players || []}
                        onScoreChange={(change) => handleScoreChange("team2", change)}
                        onReset={() => resetScore("team2")}
                        formik={formik}
                        teamName="team2Score"
                    />
                </div>

                <div className={stl.actions}>
                    <button type="button" onClick={() => updateScore(false)}>Update</button>
                    <button type="button" onClick={finalizeScore}>Final</button>
                    <button type="button" onClick={() => setShowWalkoverModal(true)}>Walkover</button>
                </div>
            </form>

            <Dialog open={showWalkoverModal} onClose={() => setShowWalkoverModal(false)}>
                <DialogTitle>Mark as Walkover</DialogTitle>
                <DialogContent>
                    <p>Select the team that showed up. It wins the match.</p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowWalkoverModal(false)} style={{ color: '#F28C28' }}>
                        Cancel
                    </Button>
                    {[scoreData.team1, scoreData.team2].map((team) => (
                        <Button key={team.team_id} onClick={() => markWalkover(team.team_id)} style={{ color: '#4CAF50' }}>
                            Team {team.team_id} wins
                        </Button>
                    ))}
                </DialogActions>
            </Dialog>

            {isModalOpen && (
                <div className={stl.modal}>
                    <div className={stl.modalContent}>
                        <p>Are you sure you want to finalize the scores?</p>
                        <button onClick={confirmFinalize} style={{ backgroundColor: '#4CAF50', color: 'white' }}>Confirm</button>
                        <button onClick={() => setModalOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}

            <Dialog 
                open={showStatusModal} 
                onClose={handleBackToMatches}
            >
                <DialogTitle>
                    {matchStatus === 'completed' ? 'Match Completed' : 'Match Not Started'}
                </DialogTitle>
                <DialogContent>
                    {matchStatus === 'completed' ? (
                        <p>This match has been completed. Would you like to override the scores?</p>
                    ) : (
                        <p>This match hasn't started yet. Would you like to start the match?</p>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={handleBackToMatches}
                        style={{ color: '#F28C28' }}
                    >
                        Cancel
                    </Button>
                    {matchStatus === 'completed' ? (
                        <Button 
                            onClick={() => setShowStatusModal(false)}
                            style={{ color: '#4CAF50' }}
                        >
                            Override Score
                        </Button>
                    ) : (
                        <Button 
                            onClick={handleStartMatch}
                            style={{ color: '#4CAF50' }}
                        >
                            Start Match
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </div>
    );
};

const TeamCard = ({ team, players = [], onScoreChange, onReset, formik, teamName }) => (
    <div className={stl.teamCard}>
        <div className={stl.teamHeader}>
            <h4>Team {team?.team_id || 'Unknown'}</h4>
            <div className={stl.playerNames}>
                {players.map((player, index) => (
                    <p key={index} className={stl.playerName}>
                        {player.first_name} {player.last_name}
                        {index < players.length - 1 ? " & " : ""}
                    </p>
                ))}
            </div>
        </div>
        
        <TextField
            size="small"
            className={stl.score}
            value={formik.values[teamName]}
            onChange={(e) => formik.setFieldValue(teamName, Math.max(0, Number(e.target.value) || 0))}
            error={Boolean(formik.errors[teamName])}
            helperText={formik.errors[teamName]}
        />
        
        <div className={stl.scoreControls}>
            <button type="button" onClick={() => onScoreChange(1)}>+1</button>
            <button type="button" onClick={() => onScoreChange(-1)}>-1</button>
            <button type="button" className={stl.reset} onClick={onReset}>Reset</button>
        </div>
    </div>
);

export default MatchScreen;
